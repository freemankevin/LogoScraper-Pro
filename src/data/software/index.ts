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
import fashion from './fashion.json'
import beauty from './beauty.json'
import electronics from './electronics.json'
import automotive from './automotive.json'
import food from './food.json'
import finance from './finance.json'
import retail from './retail.json'
import media from './media.json'
import sports from './sports.json'
import travel from './travel.json'
import health from './health.json'
import energy from './energy.json'
import telecom from './telecom.json'
import asia from './asia.json'

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
  ...fashion,
  ...beauty,
  ...electronics,
  ...automotive,
  ...food,
  ...finance,
  ...retail,
  ...media,
  ...sports,
  ...travel,
  ...health,
  ...energy,
  ...telecom,
  ...asia,
}
