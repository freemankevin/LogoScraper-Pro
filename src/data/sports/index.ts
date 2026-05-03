import brands from './brands.json'

export default brands as Record<string, { domains: string[]; clearbitDomains?: string[]; github?: string; githubPaths?: string[]; wikipedia?: string }>
