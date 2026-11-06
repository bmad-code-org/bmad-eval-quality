// Starlight exposes component overrides at runtime; its public types omit these modules.
declare module 'virtual:starlight/components/Search' {
	const Component: typeof import('@astrojs/starlight/components/Search.astro').default
	export default Component
}

declare module 'virtual:starlight/components/SiteTitle' {
	const Component: typeof import('@astrojs/starlight/components/SiteTitle.astro').default
	export default Component
}

declare module 'virtual:starlight/components/SocialIcons' {
	const Component: typeof import('@astrojs/starlight/components/SocialIcons.astro').default
	export default Component
}

declare module 'virtual:starlight/components/ThemeSelect' {
	const Component: typeof import('@astrojs/starlight/components/ThemeSelect.astro').default
	export default Component
}
