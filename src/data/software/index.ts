import development from './development.json'
import frontend from './frontend.json'
import backend from './backend.json'
import database from './database.json'
import devops from './devops.json'
import cloud from './cloud.json'
import design from './design.json'
import office from './office.json'
import communication from './communication.json'
import security from './security.json'
import game from './game.json'
import os from './os.json'

export interface KnownSoftwareInfo {
  domains: string[]
  clearbitDomains?: string[]
  github?: string
  githubPaths?: string[]
  wikipedia?: string
}

export const KNOWN_SOFTWARE: Record<string, KnownSoftwareInfo> = {
  ...development,
  ...frontend,
  ...backend,
  ...database,
  ...devops,
  ...cloud,
  ...design,
  ...office,
  ...communication,
  ...security,
  ...game,
  ...os,
}
