/**
 * Main JavaScript for Personal Website
 * Handles all page functionality including content loading, theme switching, and interactions
 * 
 * Wrapped in IIFE to avoid polluting global scope
 */
(function() {
    'use strict';

    /**
     * ===================================================================
     *                    SUPABASE CONFIGURATION
     * ===================================================================
     */
    const SUPABASE_URL  = 'https://pcqaiztmkdrcsplwbvej.supabase.co';
    const SUPABASE_ANON = 'sb_publishable_87vzWy_5tTOm9hw5luhsgA_2YBixaE7';

    /**
     * ===================================================================
     *                    CONFIGURATION LOADING
     * ===================================================================
     */

    // Cache for the loaded YAML config
    let siteConfig = null;

    /**
     * Load and parse the YAML configuration file
     * @returns {Promise<object>} Parsed configuration object
     */
    async function loadConfig() {
        if (siteConfig) {
            return siteConfig;
        }
        
        try {
            // Determine the correct path based on current location
            const configPath = window.BLOG_POST_ID ? '../content/site/config.yaml' : 'content/site/config.yaml';
            const response = await fetch(configPath);
            const yamlText = await response.text();
            siteConfig = jsyaml.load(yamlText);
            return siteConfig;
        } catch (error) {
            console.error('Error loading config:', error);
            return null;
        }
    }

    /**
     * Apply the active colour palette from config to CSS custom properties.
     * Sets four palette vars on :root — the theme blocks (light/dark) reference
     * these via var(), so the theme toggle continues to work automatically.
     */
    async function applyPalette() {
        const config = await loadConfig();
        const colors = config?.design?.colors;
        if (!colors) return;

        const palette = colors.palettes?.[colors.active_palette];
        if (!palette) return;

        const root = document.documentElement;
        root.style.setProperty('--palette-light-link',  palette.light.link);
        root.style.setProperty('--palette-light-hover', palette.light.hover);
        root.style.setProperty('--palette-dark-link',   palette.dark.link);
        root.style.setProperty('--palette-dark-hover',  palette.dark.hover);
    }

    /**
     * Load and parse a YAML content file
     * @param {string} path - Path to YAML file
     * @returns {Promise<object|array>} Parsed YAML data
     */
    async function loadYaml(path) {
        try {
            // If we're in a blog post (has BLOG_POST_ID) and path starts with 'blogs/',
            // the path is already correct (we're in blogs/ directory)
            let adjustedPath = path;
            if (window.BLOG_POST_ID && path.startsWith('blogs/')) {
                adjustedPath = path.substring('blogs/'.length);
            }
            const response = await fetch(adjustedPath);
            const yamlText = await response.text();
            return jsyaml.load(yamlText);
        } catch (error) {
            console.error(`Error loading YAML from ${path}:`, error);
            return null;
        }
    }

    /**
     * ===================================================================
     *                    UTILITY FUNCTIONS
     * ===================================================================
     */

    /**
     * Format a date string into human-readable format
     * @param {string} dateString - ISO date string
     * @param {object} options - Intl.DateTimeFormat options
     * @returns {string} Formatted date string
     */
    function formatDate(dateString, options = { year: 'numeric', month: 'long', day: 'numeric' }) {
        return new Date(dateString).toLocaleDateString('en-US', options);
    }

    /**
     * Convert basic markdown formatting to HTML
     * Handles bold text, links, and paragraph breaks
     * @param {string} markdown - Raw markdown text
     * @returns {string} HTML formatted text
     */
    function convertSimpleMarkdownToHtml(markdown) {
        return markdown
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')  // Bold text
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')  // Links
            .replace(/\n\n+/g, '</p><p>')  // Paragraph breaks
            .replace(/^/, '<p>')  // Start with paragraph
            .replace(/$/, '</p>');  // End with paragraph
    }

    /**
     * Apply inline markdown formatting (bold, italic, links)
     * Used for single-line text like titles and descriptions
     * @param {string} text - Text with markdown formatting
     * @returns {string} HTML formatted text
     */
    function formatInlineMarkdown(text) {
        return text
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')  // Links
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')  // Bold
            .replace(/\*([^*]+)\*/g, '<em>$1</em>');  // Italic
    }

/**
 * Parse markdown to HTML for blog posts
 * Handles headings, links, bold, italic, and paragraphs
 * @param {string} markdown - Raw markdown text
 * @returns {string} HTML formatted text
 */
function parseMarkdown(markdown) {
    // Remove frontmatter (YAML between ---)
    markdown = markdown.replace(/^---[\s\S]*?---\n/, '');

    // Replace {{TOC}} placeholder with a DOM anchor the TOC generator will find
    markdown = markdown.replace(/\{\{TOC\}\}/g, '<div id="toc-placeholder"></div>');

    let html = markdown;
    
    // Parse headings
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
    
    // Parse links [text](url)
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    
    // Parse bold **text** or __text__
    html = html.replace(/\*\*([^\*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');
    
    // Parse italic *text*
    html = html.replace(/\*([^\*]+)\*/g, '<em>$1</em>');
    
    // Parse lists - handle both unordered (-) and ordered (1.)
    const blocks = html.split(/\n\n+/);
    html = blocks.map(block => {
        block = block.trim();
        if (!block) return '';
        
        // Check for unordered list (lines starting with - or *)
        const isUnorderedList = block.split('\n').every(line => 
            line.trim().match(/^[-*]\s/) || line.trim() === ''
        );
        
        if (isUnorderedList && block.match(/^[-*]\s/m)) {
            const listItems = block.split('\n')
                .filter(line => line.trim())
                .map(line => {
                    const match = line.match(/^[-*]\s+(.+)$/);
                    return match ? `<li>${match[1]}</li>` : '';
                })
                .join('\n');
            return `<ul>\n${listItems}\n</ul>`;
        }
        
        // Check for ordered list (lines starting with numbers)
        const isOrderedList = block.split('\n').every(line => 
            line.trim().match(/^\d+\.\s/) || line.trim() === ''
        );
        
        if (isOrderedList && block.match(/^\d+\.\s/m)) {
            const listItems = block.split('\n')
                .filter(line => line.trim())
                .map(line => {
                    const match = line.match(/^\d+\.\s+(.+)$/);
                    return match ? `<li>${match[1]}</li>` : '';
                })
                .join('\n');
            return `<ol>\n${listItems}\n</ol>`;
        }
        
        // Don't wrap if it's already an HTML tag
        if (block.startsWith('<h') || block.startsWith('<figure') ||
            block.startsWith('<ul') || block.startsWith('<ol') ||
            block.startsWith('<div') || block.startsWith('</')) {
            return block;
        }
        return '<p>' + block + '</p>';
    }).join('\n');
    
    return html;
}

/**
 * Initialize theme settings for the site.
 * The site uses light mode only and does not support theme toggling.
 */
function initializeTheme() {
    document.documentElement.setAttribute('data-theme', 'light');
}


/**
 * ===================================================================
 *                    TIMELINE FUNCTIONS
 * ===================================================================
 */

/**
 * Load experience timeline from YAML
 * Displays experience items sorted by date (most recent first)
 */
async function loadTimeline() {
    try {
        const timeline = await loadYaml('content/timeline/timeline.yaml');
        const listContainer = document.getElementById('timeline-list');
        
        if (!listContainer || !timeline) return;
        
        // Sort by start date (most recent first)
        timeline.sort((a, b) => {
            const dateA = new Date(a.start_date);
            const dateB = new Date(b.start_date);
            return dateB - dateA;
        });
        
        const timelineItems = timeline.map(item => {
            const startDate = new Date(item.start_date);
            const startYear = startDate.getFullYear();
            
            let endYear = '';
            if (item.end_date) {
                if (item.end_date.toLowerCase() === 'present') {
                    endYear = 'Present';
                } else {
                    const endDate = new Date(item.end_date);
                    endYear = endDate.getFullYear();
                }
            }
            
            const yearRange = endYear ? `${startYear} - ${endYear}` : `${startYear} -`;
            
            // Format description with markdown support and paragraph breaks
            let formattedDescription = item.description || '';
            formattedDescription = formatInlineMarkdown(formattedDescription);
            // Support paragraph breaks with \n\n - split and wrap each part in its own paragraph
            const paragraphs = formattedDescription.split(/\n\n+/).map(para => `<p class="timeline-description">${para.trim()}</p>`).join('');
            
            // Make logo clickable if URL exists
            const logoHTML = item.url 
                ? `<a href="${item.url}" target="_blank" rel="noopener noreferrer" class="timeline-logo-link"><img src="${item.logo}" alt="${item.organization} logo" class="timeline-logo"></a>`
                : `<img src="${item.logo}" alt="${item.organization} logo" class="timeline-logo">`;
            
            return `
            <div class="timeline-item">
                <div class="timeline-dot"></div>
                <div class="timeline-year">${yearRange}</div>
                ${logoHTML}
                <div class="timeline-content">
                    ${paragraphs}
                </div>
            </div>
            `;
        });
        
        listContainer.innerHTML = timelineItems.join('');
    } catch (error) {
        console.error('Error loading timeline:', error);
    }
}


/**
 * ===================================================================
 *                    MAIN PAGE FUNCTIONS (index.html)
 * ===================================================================
 */

/**
 * Load site metadata (name, role, affiliation) from site.json
 * Updates the site name, role title, affiliation, and footer name
 */
async function loadSiteMetadata() {
    try {
        const config = await loadConfig();
        if (!config) return;
        
        // Update site name in header
        const siteNameElement = document.getElementById('site-name');
        if (siteNameElement && config.site?.name) {
            siteNameElement.textContent = config.site.name;
        }

        // Update page title
        const pageTitleElement = document.getElementById('page-title');
        if (pageTitleElement && config.site?.page_title) {
            pageTitleElement.textContent = config.site.page_title;
        }
        
        // Update nationality flags (optional)
        const nationalityFlagsElement = document.getElementById('nationality-flags');
        if (nationalityFlagsElement && config.site?.nationality_flags) {
            nationalityFlagsElement.textContent = config.site.nationality_flags;
        }
        
        // Update role information
        const roleTitleElement = document.getElementById('role-title');
        const roleAffiliationElement = document.getElementById('role-affiliation');
        if (roleTitleElement && config.site?.role?.title) {
            roleTitleElement.textContent = config.site.role.title;
        }
        if (roleAffiliationElement && config.site?.role?.affiliation) {
            roleAffiliationElement.textContent = config.site.role.affiliation;
        }
        
        // Update footer name
        const footerNameElement = document.getElementById('footer-name');
        if (footerNameElement && config.site?.footer_name) {
            footerNameElement.textContent = config.site.footer_name;
        }
    } catch (error) {
        console.error('Error loading site metadata:', error);
    }
}

/**
 * Load layout configuration for navigation and section titles
 * Updates navigation links, section headings, and footer content
 */
async function loadLayoutConfiguration() {
    try {
        const config = await loadConfig();
        if (!config) return;
        
        // Build navigation menu
        const navLinksElement = document.getElementById('nav-links');
        if (navLinksElement && config.layout?.header?.navigation) {
            navLinksElement.innerHTML = '';

            config.layout.header.navigation.forEach(navItem => {
                const linkElement = document.createElement('a');
                let href = navItem.href;

                // Replace {{cv_url}} placeholder with actual CV URL
                if (href.includes('{{cv_url}}') && config.site?.cv_url) {
                    href = href.replace('{{cv_url}}', config.site.cv_url);
                }

                linkElement.href = href;
                linkElement.innerHTML = navItem.label;

                // Add target="_blank" for external links (like CV)
                if (navItem.is_external) {
                    linkElement.target = '_blank';
                    linkElement.rel = 'noopener noreferrer';
                }

                navLinksElement.appendChild(linkElement);
            });
        }
        
        // Update optional section titles and subtitles
        const updateSectionHeader = (sectionAnchorId, titleElementId, subtitleElementId, sectionConfig) => {
            const sectionHeader = document.getElementById(sectionAnchorId);
            const titleElement = document.getElementById(titleElementId);
            const subtitleElement = document.getElementById(subtitleElementId);
            const title = sectionConfig?.title;
            const subtitle = sectionConfig?.subtitle;

            if (titleElement) {
                if (title) {
                    titleElement.textContent = title;
                } else {
                    titleElement.remove();
                }
            }

            if (subtitleElement) {
                if (subtitle) {
                    subtitleElement.textContent = subtitle;
                } else {
                    subtitleElement.remove();
                }
            }

            if (sectionHeader && !title && !subtitle) {
                sectionHeader.classList.add('is-empty');
            }
        };

        updateSectionHeader(
            'experience-heading',
            'experience-title',
            'experience-subtitle',
            config.layout?.sections?.timeline
        );
        updateSectionHeader(
            'projects-heading',
            'projects-title',
            'projects-subtitle',
            config.layout?.sections?.projects
        );
        updateSectionHeader(
            'publications-heading',
            'publications-title',
            'publications-subtitle',
            config.layout?.sections?.publications
        );
        updateSectionHeader(
            'blog-heading',
            'blog-title',
            'blog-subtitle',
            config.layout?.sections?.blog
        );
        
        // Update footer content
        const footerTaglineElement = document.getElementById('footer-tagline');
        const footerYearElement = document.getElementById('footer-year');
        const footerLicenseElement = document.getElementById('footer-license');
        
        if (footerTaglineElement && config.layout?.footer?.tagline) {
            footerTaglineElement.innerHTML = formatInlineMarkdown(config.layout.footer.tagline);
        }
        if (footerYearElement && config.layout?.footer?.year) {
            footerYearElement.textContent = config.layout.footer.year;
        }
        if (footerLicenseElement && config.layout?.footer?.license_text) {
            const licenseUrl = config.layout.footer.license_url || '#';
            footerLicenseElement.href = licenseUrl;
            footerLicenseElement.textContent = config.layout.footer.license_text;
        }
    } catch (error) {
        console.error('Error loading layout configuration:', error);
    }
}

/**
 * Load profile content from config or fallback to bio.md
 * Converts markdown formatting to HTML for display
 */
async function loadProfileContent() {
    try {
        const config = await loadConfig();
        let markdownContent;
        
        if (config?.site?.profile) {
            // Use profile content from config
            markdownContent = config.site.profile;
        } else {
            // Fallback to bio.md file
            const bioResponse = await fetch('content/site/bio.md');
            markdownContent = await bioResponse.text();
        }
        
        // Convert markdown to HTML
        const htmlContent = convertSimpleMarkdownToHtml(markdownContent);
        const profileElement = document.getElementById('profile-content');
        if (profileElement) {
            profileElement.innerHTML = htmlContent;
        }
        
    } catch (error) {
        console.error('Error loading profile content:', error);
    }
}

/**
 * Load social links from config and create clickable icons
 * Handles both emoji and image-based social icons
 */
async function loadSocialLinks() {
    try {
        const config = await loadConfig();
        if (!config) return;
        
        const contacts = config.contacts;
        const socialsContainer = document.getElementById('profile-socials');
        
        if (!socialsContainer || !contacts) return;
        
        contacts.forEach(contact => {
            const socialLink = document.createElement('a');
            socialLink.href = contact.url;
            socialLink.target = '_blank';
            socialLink.rel = 'noopener noreferrer';
            socialLink.className = 'social-link';
            socialLink.title = contact.name;
            
            if (contact.is_image) {
                socialLink.innerHTML = `<img src="${contact.icon}" alt="${contact.name}" class="social-icon-img">`;
            } else {
                socialLink.innerHTML = `<span class="social-icon">${contact.icon}</span>`;
            }
            
            socialsContainer.appendChild(socialLink);
        });
    } catch (error) {
        console.error('Error loading social links:', error);
    }
}

/**
 * Load projects from projects.yaml and render project cards
 * Creates interactive project entries with available resource buttons
 */
async function loadProjects() {
    try {
        const config = await loadConfig();
        const projects = await loadYaml('content/projects/projects.yaml');
        const listContainer = document.getElementById('projects-list');
        
        if (!listContainer || !projects) return;
        
        const projectCards = projects.map(project => {
            // Build buttons HTML for available resources, prioritizing slides/demo/write-up.
            const buttons = [
                { key: 'slides', label: 'Slides', url: project.slides },
                { key: 'writeup', label: 'Write-up', url: project.writeup || project.paper || project.link },
                { key: 'code', label: 'Code', url: project.code },
                { key: 'video', label: 'Video', url: project.video },
                { key: 'poster', label: 'Poster', url: project.poster }
            ];
            
            // Add article buttons from articles array
            if (project.articles && Array.isArray(project.articles)) {
                project.articles.forEach(article => {
                    buttons.push({ key: 'article', label: article.title, url: article.url });
                });
            }
            
            const availableButtons = buttons.filter(btn => btn.url);
            const buttonsHTML = availableButtons.length > 0
                ? '<div class="project-buttons">' + 
                  availableButtons.map(btn => 
                      `<a href="${btn.url}" class="project-button" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">${btn.label}</a>`
                  ).join('') + 
                  '</div>'
                : '';
            
            // Bold every instance of Lydia Haile in author strings
            const formattedAuthors = project.authors
                ? project.authors.replace(/\b(?:Lydia\s+(?:[A-Z]\s*)?Haile|Haile,\s*Lydia(?:\s+[A-Z])?)\b/g, match => `<strong>${match}</strong>`)
                : '';
            const authorsHTML = formattedAuthors ? `<p class="project-authors">${formattedAuthors}</p>` : '';
            const formattedDescription = project.description ? formatInlineMarkdown(project.description) : '';
            const descriptionHTML = formattedDescription ? `<p class="project-description-text">${formattedDescription}</p>` : '';
            const contextHTML = project.context ? `<p><b class="project-context">${project.context}</b></p>` : '';
            const targetUrl = project.writeup || project.paper || project.link || project.poster || project.slides || project.video || project.code || project.demo || '#';
            
            return `
            <div class="project" onclick="window.open('${targetUrl}', '_blank', 'noopener,noreferrer')">
                <div class="project-image">
                    <img src="${project.image}" alt="${project.title} thumbnail">
                </div>
                <div class="project-description">
                    <h2>${project.title}</h2>
                    ${authorsHTML}
                    ${contextHTML}
                    ${descriptionHTML}
                    ${buttonsHTML}
                </div>
            </div>
            `;
        });
        
        listContainer.innerHTML = projectCards.join('');
    } catch (error) {
        console.error('Error loading projects:', error);
    }
}

/**
 * Load blog posts from blogs.yaml and create blog post previews
 * Renders blog cards with titles, dates, and excerpts
 */
/**
 * Load design configuration and apply CSS custom properties
 * Sets layout variables, typography, and image sizing from design.json
 */
async function loadDesignConfiguration() {
    try {
        const response = await fetch('content/site/design.json');
        if (!response.ok) return;
        const config = await response.json();
        
        // Layout variables
        if (config.layout?.maxWidth) {
            const value = config.layout.maxWidth.value;
            const unit = config.layout.maxWidth.unit || 'px';
            document.documentElement.style.setProperty('--maxw', value + unit);
        }
        
        // Typography variables
        if (config.typography?.body?.lineHeight) {
            document.documentElement.style.setProperty(
                '--body-line-height', 
                config.typography.body.lineHeight.value
            );
        }
        
        // Image variables
        const projectThumbnail = config.images?.projectThumbnail;
        if (projectThumbnail) {
            const width = projectThumbnail.width?.value;
            const widthUnit = projectThumbnail.width?.unit || 'px';
            const height = projectThumbnail.height?.value;
            const heightUnit = projectThumbnail.height?.unit || 'px';
            const borderRadius = projectThumbnail.borderRadius || '4px';
            
            if (width) document.documentElement.style.setProperty('--project-thumb-width', width + widthUnit);
            if (height) document.documentElement.style.setProperty('--project-thumb-height', height + heightUnit);
            document.documentElement.style.setProperty('--project-thumb-radius', borderRadius);
        }
    } catch (error) {
        console.error('Error loading design configuration:', error);
    }
}

/**
 * Initialize main page
 * Loads all content sections in the correct order
 */
function initNavHighlight() {
    const navLinks = document.querySelectorAll('.nav-links a[href^="#"]');
    if (!navLinks.length) return;

    const sectionIds = [...navLinks].map(a => a.getAttribute('href').slice(1));
    const sections = sectionIds.map(id => document.getElementById(id)).filter(Boolean);

    let suppressHighlight = false;

    function updateActiveLink() {
        if (suppressHighlight) return;
        const offset = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--header-offset')) || 100;
        let current = null;
        sections.forEach(section => {
            if (section.getBoundingClientRect().top <= offset + 8) {
                current = section.id;
            }
        });
        navLinks.forEach(a => {
            a.classList.toggle('active', a.getAttribute('href') === '#' + current);
        });
    }

    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            suppressHighlight = true;
            navLinks.forEach(a => a.classList.remove('active'));
            link.blur();
            setTimeout(() => { suppressHighlight = false; }, 800);
        });
    });

    document.body.addEventListener('scroll', updateActiveLink);
    updateActiveLink();
}

function initializeMainPage() {
    // Load configurations first so CSS variables are available
    loadLayoutConfiguration();
    loadSiteMetadata();
    loadDesignConfiguration();

    // Load content
    loadProfileContent();
    loadSocialLinks();
    loadProjects();
    loadTimeline();

    // Highlight active nav section on scroll (after nav links are built)
    setTimeout(initNavHighlight, 300);
}


    /**
     * ===================================================================
     *                    BLOG PAGE FUNCTIONS
     * ===================================================================
     *//**
 * Load site metadata for blog page (simpler version)
 */
async function loadBlogSiteMetadata() {
    try {
        const config = await loadConfig();
        if (!config) return;
        
        const footerNameElement = document.getElementById('footer-name');

        if (footerNameElement && config.site?.footer_name) {
            footerNameElement.textContent = config.site.footer_name;
        }
    } catch (error) {
        console.error('Error loading site metadata:', error);
    }
}

/**
 * Load layout configuration for blog page (navigation and footer)
 */
async function loadBlogLayoutConfiguration() {
    try {
        const config = await loadConfig();
        if (!config) return;
        
        // Blog pages have no nav links — nav element is not present
        
        const footerYearElement = document.getElementById('footer-year');
        const footerTaglineElement = document.getElementById('footer-tagline');
        const footerLicenseElement = document.getElementById('footer-license');
        
        if (footerYearElement && config.layout?.footer?.year) {
            footerYearElement.textContent = config.layout.footer.year;
        }
        if (footerTaglineElement && config.layout?.footer?.tagline) {
            footerTaglineElement.textContent = config.layout.footer.tagline;
        }
        if (footerLicenseElement && config.layout?.footer?.license_text) {
            const licenseUrl = config.layout.footer.license_url || '#';
            footerLicenseElement.href = licenseUrl;
            footerLicenseElement.textContent = config.layout.footer.license_text;
        }
    } catch (error) {
        console.error('Error loading layout configuration:', error);
    }
}

/**
 * Load and render a single blog post
 * Fetches blog content, parses markdown, and generates table of contents
 */
async function loadBlogPost() {
    try {
        // Get blog ID from window variable (for individual blog HTML files) or URL query parameter
        let blogId = window.BLOG_POST_ID || null;
        
        if (!blogId) {
            const urlParams = new URLSearchParams(window.location.search);
            blogId = urlParams.get('id');
        }
        
        const blogBodyElement = document.getElementById('blog-body');
        
        if (!blogId) {
            if (blogBodyElement) {
                blogBodyElement.innerHTML = '<p>No blog post specified.</p>';
            }
            return;
        }
        
        // Determine the correct path to blogs.yaml based on current location
        const blogsYamlPath = window.BLOG_POST_ID ? 'blogs.yaml' : 'blogs/blogs.yaml';
        
        // Load blogs.yaml to find the content file
        const blogs = await loadYaml(blogsYamlPath);
        
        const blog = blogs?.find(b => b.id === blogId);
        
        if (!blog) {
            if (blogBodyElement) {
                blogBodyElement.innerHTML = '<p>Blog post not found.</p>';
            }
            return;
        }
        
        // Set title and date
        const titleElement = document.getElementById('blog-title');
        const dateElement = document.getElementById('blog-date');
        const pageTitleElement = document.getElementById('page-title');
        
        if (titleElement) titleElement.textContent = blog.title;
        if (pageTitleElement) pageTitleElement.textContent = `🤘 Fablogio`;
        wireShareButtons(blog.title);
        const headerTitleElement = document.getElementById('blog-header-title');
        if (headerTitleElement) {
            headerTitleElement.textContent =
                (window.BLOG_POST_DATA && window.BLOG_POST_DATA.short_title)
                    ? window.BLOG_POST_DATA.short_title
                    : blog.title;
        }
        if (dateElement) {
            const readingTime = blog.reading_time || (window.BLOG_POST_DATA && window.BLOG_POST_DATA.reading_time);
            dateElement.textContent = formatDate(blog.date) + (readingTime ? ' · ' + readingTime : '');
        }
        
        // Load and parse content
        let htmlContent;
        
        // Check if we have embedded blog data (new format)
        if (window.BLOG_POST_DATA) {
            htmlContent = parseMarkdown(window.BLOG_POST_DATA.content);
        } else if (blog.content_file) {
            // Legacy: Load from separate JSON file
            let contentPath = blog.content_file;
            if (window.BLOG_POST_ID) {
                contentPath = blog.content_file.replace('blogs/', '');
            }
            
            const contentResponse = await fetch(contentPath);
            const contentData = await contentResponse.json();
            htmlContent = parseMarkdown(contentData.content);
        } else if (blog.markdown_file) {
            // Legacy: Load markdown file (for backward compatibility)
            const markdownResponse = await fetch(blog.markdown_file);
            const markdownText = await markdownResponse.text();
            htmlContent = parseMarkdown(markdownText);
        } else {
            throw new Error('No content available');
        }
        
        if (blogBodyElement) {
            blogBodyElement.innerHTML = htmlContent;
            
            // Fix relative image paths for blog content
            // Images in markdown are relative to blogs/ directory
            const images = blogBodyElement.querySelectorAll('img');
            images.forEach(img => {
                const src = img.getAttribute('src');
                // Only fix relative paths that don't already start with http or /
                if (src && !src.startsWith('http') && !src.startsWith('/')) {
                    // If we're in a blog HTML file (has BLOG_POST_ID), paths are already relative to blogs/
                    // If we're not, we need to prepend the path
                    if (!window.BLOG_POST_ID && !src.includes('blogs/')) {
                        img.setAttribute('src', `blogs/${src}`);
                    }
                }
            });
        }
        
        // Generate table of contents
        generateTableOfContents();

        // Initialize like button
        await initSunLike(blogId);

    } catch (error) {
        console.error('Error loading blog post:', error);
        const blogBodyElement = document.getElementById('blog-body');
        if (blogBodyElement) {
            blogBodyElement.innerHTML = '<p>Error loading blog post.</p>';
        }
    }
}

/**
 * Generate table of contents from h2 and h3 headings in blog post
 * Creates interactive TOC with scroll highlighting
 */
function generateTableOfContents() {
    const blogBody = document.getElementById('blog-body');
    const headerNav = document.getElementById('blog-header-nav');
    if (!blogBody) return;

    const headings = blogBody.querySelectorAll('h2, h3');

    // Assign IDs and group by h2
    const groups = [];
    let currentGroup = null;
    headings.forEach((heading, index) => {
        heading.id = `section-${index}`;
        if (heading.tagName === 'H2') {
            currentGroup = { h2: heading, h3s: [] };
            groups.push(currentGroup);
        } else {
            if (!currentGroup) { currentGroup = { h2: null, h3s: [] }; groups.push(currentGroup); }
            currentGroup.h3s.push(heading);
        }
    });

    // --- INLINE TOC (h2s only, only when {{TOC}} placeholder present) ---
    const h2Headings = [...headings].filter(h => h.tagName === 'H2');
    const tocPlaceholder = blogBody.querySelector('#toc-placeholder');
    if (tocPlaceholder && h2Headings.length > 0) {
        const inlineToc = document.createElement('div');
        inlineToc.className = 'blog-inline-toc';
        inlineToc.id = 'blog-inline-toc';
        inlineToc.innerHTML = '<h3 class="blog-toc-heading">Table of Contents</h3>';
        const ul = document.createElement('ul');
        h2Headings.forEach(h2 => {
            const li = document.createElement('li');
            const a = document.createElement('a');
            a.href = `#${h2.id}`;
            a.textContent = h2.textContent;
            a.addEventListener('click', e => {
                e.preventDefault();
                h2.scrollIntoView({ behavior: 'smooth', block: 'start' });
                window.history.pushState(null, '', `#${h2.id}`);
            });
            li.appendChild(a);
            ul.appendChild(li);
        });
        inlineToc.appendChild(ul);
        tocPlaceholder.replaceWith(inlineToc);
    } else {
        // No {{TOC}} — remove orphaned placeholder if present
        if (tocPlaceholder) tocPlaceholder.remove();
    }

    // --- READING PROGRESS PILL ---
    const progressPill = document.createElement('div');
    progressPill.className = 'blog-progress';
    progressPill.id = 'blog-progress';
    document.body.appendChild(progressPill);

    // --- CURRENT SECTION INDICATOR ---
    if (headerNav) {
        const h2Indicator = document.createElement('span');
        h2Indicator.className = 'blog-current-h2';
        h2Indicator.id = 'blog-current-section'; // keep for any external refs

        const h3Indicator = document.createElement('span');
        h3Indicator.className = 'blog-current-h3';

        headerNav.appendChild(h2Indicator);
        headerNav.appendChild(h3Indicator);

        document.body.addEventListener('scroll', () => {
            let currentH2 = null;
            let currentH3 = null;
            headings.forEach(h => {
                if (h.getBoundingClientRect().top <= 120) {
                    if (h.tagName === 'H2') {
                        currentH2 = h;
                        currentH3 = null; // reset subsection when entering a new section
                    } else if (h.tagName === 'H3') {
                        currentH3 = h;
                    }
                }
            });
            h2Indicator.textContent = currentH2 ? currentH2.textContent : '';
            h3Indicator.textContent = currentH3 ? currentH3.textContent : '';
            headerNav.style.display = currentH2 ? '' : 'none';

            const pct = Math.round(
                document.body.scrollTop / (document.body.scrollHeight - document.body.clientHeight) * 100
            );
            progressPill.textContent = pct + '%';
            progressPill.style.setProperty('--fill', pct + '%');
            progressPill.classList.toggle('visible', pct > 0);
        });

        // Set initial state (hidden until scrolling begins)
        headerNav.style.display = 'none';
    }
}

/**
 * Wire share buttons with the current page URL and post title
 */
function wireShareButtons(title) {
    const url = encodeURIComponent(window.location.href);
    const text = encodeURIComponent(title);

    const li = document.getElementById('share-linkedin');
    const x  = document.getElementById('share-x');
    const em = document.getElementById('share-email');

    if (li) li.href = `https://www.linkedin.com/sharing/share-offsite/?url=${url}`;
    if (x)  x.href  = `https://x.com/intent/tweet?url=${url}&text=${text}`;
    if (em) em.href = `mailto:?subject=${text}&body=${url}`;
}

/**
 * ===================================================================
 *                    SUN LIKE BUTTON
 * ===================================================================
 */

/**
 * Initialize the sun like button for a blog post.
 * Fetches current like count, handles click (increment + optimistic UI),
 * and persists liked state in localStorage.
 * @param {string} postId - The blog post ID
 */
async function initSunLike(postId) {
    const btn   = document.getElementById('sun-like-btn');
    const count = document.getElementById('sun-like-count');
    if (!btn || !count) return;

    const storageKey = `liked:${postId}`;
    const alreadyLiked = localStorage.getItem(storageKey) === '1';

    // Fetch current count
    try {
        const res = await fetch(
            `${SUPABASE_URL}/rest/v1/blog_stats?post_id=eq.${encodeURIComponent(postId)}&select=likes`,
            { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` } }
        );
        if (res.ok) {
            const rows = await res.json();
            const likes = rows.length > 0 ? rows[0].likes : 0;
            count.textContent = likes > 0 ? likes : '';
        }
    } catch (_) { /* network error — show no count */ }

    if (alreadyLiked) {
        btn.classList.add('liked');
        btn.disabled = true;
    }

    btn.addEventListener('click', async () => {
        if (btn.disabled) return;
        btn.disabled = true;
        btn.classList.add('liked');
        localStorage.setItem(storageKey, '1');

        // Optimistic increment
        const prev = parseInt(count.textContent, 10) || 0;
        count.textContent = prev + 1;

        try {
            const res = await fetch(
                `${SUPABASE_URL}/rest/v1/rpc/increment_like`,
                {
                    method: 'POST',
                    headers: {
                        apikey: SUPABASE_ANON,
                        Authorization: `Bearer ${SUPABASE_ANON}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ p_post_id: postId }),
                }
            );
            if (res.ok) {
                const newCount = await res.json();
                count.textContent = newCount > 0 ? newCount : prev + 1;
            }
        } catch (_) {
            // Silent rollback on network failure
            count.textContent = prev || '';
            btn.classList.remove('liked');
            btn.disabled = false;
            localStorage.removeItem(storageKey);
        }
    });
}

/**
 * Initialize blog page
 * Loads metadata and blog post content
 */
function initializeBlogPage() {
    loadBlogLayoutConfiguration();
    loadBlogSiteMetadata();
    loadBlogPost();
    const headerTitle = document.getElementById('blog-header-title');
    if (headerTitle) {
        headerTitle.addEventListener('click', () => {
            headerTitle.blur();
            headerTitle.classList.add('just-clicked');
            setTimeout(() => headerTitle.classList.remove('just-clicked'), 300);
        });
    }
}


/**
 * ===================================================================
 *                    PAGE DETECTION AND INITIALIZATION
 * ===================================================================
 */

// Dynamically update --header-offset based on actual header height
function updateHeaderOffset() {
    const header = document.querySelector('header');
    if (header) {
        const height = header.getBoundingClientRect().height;
        document.documentElement.style.setProperty('--header-offset', height + 16 + 'px');
    }
}

// Initialize the appropriate page when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initializeTheme();
        applyPalette();

        // Detect which page we're on
        if (document.getElementById('blog-body')) {
            // We're on the blog detail page
            initializeBlogPage();
        } else if (document.getElementById('profile-content')) {
            // We're on the main page
            initializeMainPage();
        }

        // Set header offset after content loads and on resize
        setTimeout(updateHeaderOffset, 100);
        window.addEventListener('resize', updateHeaderOffset);
    });
} else {
    initializeTheme();
    applyPalette();

    // Detect which page we're on
    if (document.getElementById('blog-body')) {
        initializeBlogPage();
    } else if (document.getElementById('profile-content')) {
        initializeMainPage();
    }

    setTimeout(updateHeaderOffset, 100);
    window.addEventListener('resize', updateHeaderOffset);
}

})(); // End of IIFE
