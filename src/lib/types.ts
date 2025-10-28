// Common interface for all tab components
export interface TabComponentProps {
  onLoginClick?: () => void;
  isMobileView?: boolean;
}

// Tab types for navigation
export type TabType = 'dashboard' | 'members' | 'assets' | 'manufacturing' | 'mining' | 'planetary' | 'projects' | 'logistics' | 'market' | 'wallet' | 'notifications' | 'sync-monitoring' | 'corporations' | 'theme' | 'settings';

// Member management types
export interface Member {
  id: number;
  characterId: number;
  characterName?: string;
  name?: string; // Alternative name field used in some contexts
  corporationId: number;
  corporationName?: string;
  allianceId?: number;
  allianceName?: string;
  roles?: string[];
  titles?: string[];
  title?: string; // Single title field used in some contexts
  lastLogin?: string;
  location?: string;
  ship?: string; // Ship name (simplified)
  shipTypeId?: number;
  shipTypeName?: string;
  logonDuration?: number;
  startDateTime?: string;
  logoffDateTime?: string;
  isOnline?: boolean;
  isActive: boolean;
  accessLevel?: 'member' | 'director' | 'ceo';
  joinedDate?: string;
  joinDate?: string; // Alternative field name
  totalSkillPoints?: number;
  activeClones?: number;
  securityStatus?: number;
}

// Manufacturing types
export interface ManufacturingJob {
  id: string;
  jobId?: number;
  installerId: number;
  installerName: string;
  facilityId: number;
  facility: string;
  facilityName?: string;
  stationId?: number;
  blueprintId: number;
  blueprintName: string;
  blueprintTypeId?: number;
  blueprintTypeName?: string;
  blueprintLocationId?: number;
  outputLocationId?: number;
  runs: number;
  cost: number;
  licensedRuns?: number;
  probability?: number;
  productTypeId: number;
  productTypeName: string;
  productQuantity: number;
  status: 'active' | 'paused' | 'ready' | 'delivered' | 'cancelled' | 'reverted' | 'completed';
  timeInSeconds?: number;
  duration: number;
  startDate: string;
  endDate: string;
  pauseDate?: string;
  completedDate?: string;
  completedCharacterId?: number;
  successfulRuns?: number;
  activityId?: number;
  activityName?: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  profitMargin?: number;
  estimatedProfit?: number;
  materialEfficiency: number;
  timeEfficiency: number;
  materials: MaterialRequirement[];
}

export interface Blueprint {
  id: string;
  itemId?: number;
  typeId: number;
  typeName: string;
  location: string;
  locationId?: number;
  locationName?: string;
  locationFlag?: string;
  quantity?: number;
  materialEfficiency: number;
  timeEfficiency: number;
  runs: number;
  maxRuns?: number;
  isCopy?: boolean;
  isOriginal: boolean;
  category: string;
  categoryId?: number;
  categoryName?: string;
  groupId?: number;
  groupName?: string;
  metaLevel?: number;
  techLevel?: number;
  estimatedValue: number;
  productTypeId: number;
  productTypeName: string;
  productQuantity?: number;
  baseTime: number;
  manufacturingTime?: number;
  jobType: string;
  baseMaterials: MaterialRequirement[];
  materials?: MaterialRequirement[];
  ownerName?: string;
  ownerId?: number;
}

export interface ProductionPlan {
  id: string;
  name: string;
  description?: string;
  targetProduct: {
    typeId: number;
    typeName: string;
    quantity: number;
  };
  blueprints: Blueprint[];
  materials: MaterialRequirement[];
  estimatedCost: number;
  estimatedProfit: number;
  estimatedDuration: number;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'draft' | 'approved' | 'in_progress' | 'completed' | 'cancelled';
  createdBy: string;
  createdDate: string;
  assignedTo?: string;
  startDate?: string;
  completionDate?: string;
}

// Manufacturing Job Assignment types - LMeve style task management
export interface ManufacturingTask {
  id: string;
  
  // Task definition - simplified
  targetItem: {
    typeId: number;
    typeName: string;
    quantity: number;
  };
  
  // Assignment details - simplified
  assignedTo?: string | null;
  assignedToName?: string;
  status: 'assigned' | 'in_progress' | 'completed' | 'unassigned';
  
  // Pay modifier - simplified (only one can be applied)
  payModifier?: 'rush' | 'specialDelivery' | 'excessWork' | null;
  
  // Time tracking
  estimatedDuration: number; // in seconds
  createdDate: string;
  startedDate?: string;
  completedDate?: string;
  
  // Corporation tracking
  corporationId?: number;
  
  // Optional fields for backward compatibility with complex tasks
  title?: string;
  description?: string;
  taskType?: 'manufacturing' | 'research' | 'invention' | 'copy' | 'reaction';
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  blueprintId?: number;
  blueprintName?: string;
  runs?: number;
  materialEfficiency?: number;
  timeEfficiency?: number;
  createdBy?: string;
  createdByName?: string;
  assignedDate?: string;
  assignedBy?: string;
  assignedByName?: string;
  deliveredDate?: string;
  progressNotes?: string[];
  completionProof?: {
    jobId?: string;
    screenshots?: string[];
    deliveryLocation?: string;
    actualQuantity?: number;
  };
  materials?: MaterialRequirement[];
  estimatedCost?: number;
  suggestedLocation?: string;
  requiredSkills?: Array<{
    skillId: number;
    skillName: string;
    level: number;
  }>;
  reward?: {
    type: 'fixed' | 'percentage' | 'market_rate' | 'points';
    amount: number;
    paymentStatus: 'pending' | 'approved' | 'paid';
    bonusConditions?: Array<{
      condition: string;
      bonus: number;
    }>;
  };
  deadline?: string;
  preferredStartTime?: string;
  canDelayUntil?: string;
  corporationName?: string;
  tags?: string[];
  relatedTasks?: string[]; // IDs of related tasks
}

export interface MaterialRequirement {
  typeId: number;
  typeName: string;
  quantity: number;
  quantityAvailable?: number;
  quantityNeeded?: number;
  totalValue: number;
  estimatedCost?: number;
  priority?: 'critical' | 'high' | 'normal' | 'low';
  source?: 'inventory' | 'market' | 'manufacturing' | 'mining';
  available?: number;
  category?: string;
  unitPrice?: number;
}

// Income tracking types
export interface IncomeRecord {
  id: string;
  date: string;
  pilotId: number;
  pilotName: string;
  activityType: 'manufacturing' | 'mining' | 'research' | 'invention' | 'reactions';
  jobId?: number;
  itemTypeId: number;
  itemTypeName: string;
  quantity: number;
  hoursWorked: number;
  ratePerHour: number;
  totalEarned: number;
  status: 'pending' | 'approved' | 'paid';
  approvedBy?: string;
  approvedDate?: string;
  paidDate?: string;
  notes?: string;
  completedDate?: string;
  jobType?: string;
  productTypeName?: string;
  productTypeId?: number;
  productQuantity?: number;
  profit?: number;
  totalCost?: number;
  marketValue?: number;
  profitMargin?: number;
  runs?: number;
  materialCost?: number;
}

export interface IncomeAnalytics {
  totalEarned: number;
  totalHours: number;
  averageRate: number;
  totalProfit?: number;
  totalRevenue?: number;
  averageProfitMargin?: number;
  jobsCompleted?: number;
  topEarners: Array<{
    pilotName: string;
    totalEarned: number;
    hoursWorked: number;
  }>;
  topPilots?: Array<{
    pilotId: number;
    pilotName: string;
    jobsCompleted: number;
    totalProfit: number;
    averageProfit: number;
  }>;
  topProducts?: Array<{
    productTypeId: number;
    productTypeName: string;
    quantity: number;
    totalProfit: number;
    averageProfit: number;
  }>;
  monthlyTrends?: Array<{
    month: string;
    totalProfit: number;
    totalRevenue: number;
    jobsCompleted: number;
  }>;
  activityBreakdown: Array<{
    activityType: string;
    totalEarned: number;
    percentage: number;
  }>;
  monthlyTrend: Array<{
    month: string;
    totalEarned: number;
    totalHours: number;
  }>;
}

// Comprehensive notification system types
export interface NotificationTemplate {
  enabled: boolean;
  subject?: string;  // For EVE mail
  message: string;
}

export interface NotificationSettings {
  // Event notification toggles
  events: {
    manufacturing: boolean;
    mining: boolean;
    killmails: boolean;
    markets: boolean;
  };
  
  // Discord integration
  discord?: {
    enabled: boolean;
    webhookUrl?: string;
    botName?: string;
    avatarUrl?: string;
    channels?: string[];  // Channel names/IDs to mention
    roles?: string[];     // Role names to ping (with @)
    userMentions?: string[]; // EVE character IDs to mention
    embedFormat?: boolean;
    includeThumbnails?: boolean;
    throttleMinutes?: number;
    templates?: {
      manufacturing?: NotificationTemplate;
      queues?: NotificationTemplate;
      killmails?: NotificationTemplate;
      markets?: NotificationTemplate;
    };
  };
  
  // EVE Online in-game mail
  eveMail?: {
    enabled: boolean;
    senderCharacterId?: number;
    subjectPrefix?: string;
    recipientIds?: number[];  // Individual character IDs
    mailingLists?: Array<{   // Mailing list configurations
      name: string;
      id: number;
    }>;
    sendToCorporation?: boolean;
    sendToAlliance?: boolean;
    onlyToOnlineCharacters?: boolean;
    cspaChargeCheck?: boolean;  // Skip high CSPA charge recipients
    throttleMinutes?: number;
    templates?: {
      manufacturing?: NotificationTemplate;
      queues?: NotificationTemplate;
      killmails?: NotificationTemplate;
      markets?: NotificationTemplate;
    };
  };
}

// Corporation settings types
export interface CorpSettings {
  corpName: string;
  corpTicker: string;
  corpId?: number;
  timezone: string;
  language: string;
  sessionTimeout: boolean;
  notifications: NotificationSettings;
  eveOnlineSync: {
    enabled: boolean;
    autoSync: boolean;
    syncInterval: number;
    lastSync: string;
    characterId: number;
    corporationId: number;
  };
  dataSyncTimers: {
    members: number;
    assets: number;
    manufacturing: number;
    mining: number;
    market: number;
    killmails: number;
    income: number;
  };
  database: {
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
    ssl: boolean;
    connectionPoolSize: number;
    queryTimeout: number;
    autoReconnect: boolean;
    charset: string;
  };
  sudoDatabase: {
    host: string;
    port: number;
    username: string;
    password: string;
    ssl: boolean;
  };
}

// EVE API types
export interface EveApiParameter {
  name: string;
  in: 'path' | 'query' | 'body';
  required: boolean;
  type: string;
  description?: string;
}

export interface EveApiEndpoint {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  summary: string;
  description: string;
  parameters: EveApiParameter[];
  requiresAuth: boolean;
  category: string;
}

export interface EveApiCategory {
  name: string;
  description: string;
  endpoints: EveApiEndpoint[];
}

export interface ApiResponse {
  data?: any;
  error?: string;
  status: number;
  headers?: Record<string, string>;
  timestamp?: number;
}

export interface RequestHistory {
  id: string;
  endpoint: EveApiEndpoint;
  parameters: Record<string, any>;
  response: ApiResponse;
  timestamp: number;
}

// Asset management types
export interface Asset {
  id: string;
  itemId?: number;
  typeId: number;
  typeName: string;
  categoryId?: number;
  categoryName?: string;
  category?: string;
  groupId?: number;
  groupName?: string;
  quantity: number;
  locationId?: number;
  locationName?: string;
  location?: string;
  locationType?: 'station' | 'structure' | 'ship' | 'container';
  locationFlag?: string;
  hangar?: string;
  ownerId?: number;
  ownerName?: string;
  owner?: string;
  estimatedValue: number;
  estimatedPrice?: number;
  lastUpdate: string;
  isSingleton?: boolean;
  isBlueprintCopy?: boolean;
  blueprintRuns?: number;
  materialEfficiency?: number;
  timeEfficiency?: number;
}

// Corporation management types
export interface Corporation {
  id: number;
  corporationId: number;
  name: string;
  ticker: string;
  allianceId?: number;
  allianceName?: string;
  memberCount: number;
  taxRate: number;
  ceoId: number;
  ceoName: string;
  description?: string;
  url?: string;
  founded: string;
  homeStationId?: number;
  homeStationName?: string;
  walletBalance?: number;
  isActive: boolean;
  lastUpdate: string;
}

// Market data types
export interface MarketPrice {
  typeId: number;
  typeName: string;
  regionId: number;
  region: string;
  buyPrice: number;
  sellPrice: number;
  averagePrice?: number;
  adjustedPrice?: number;
  volume: number;
  orderCount?: number;
  lastUpdate: string;
  priceHistory?: Array<{
    date: string;
    volume: number;
    orderCount: number;
    lowest: number;
    highest: number;
    average: number;
  }>;
}

// Mining operations types
export interface MiningOperation {
  id: string;
  date: string;
  minerId: number;
  minerName: string;
  systemId: number;
  system: string;
  stationId?: number;
  stationName?: string;
  oreTypeId: number;
  ore: string;
  quantity: number;
  estimatedValue: number;
  refined: boolean;
  refinedBy?: number;
  refinedByName?: string;
  refinedDate?: string;
  minerals?: Array<{
    typeId: number;
    typeName: string;
    quantity: number;
    value: number;
  }>;
  notes?: string;
}

// Killmail types
export interface KillmailParticipant {
  characterId?: number;
  characterName?: string;
  corporationId: number;
  corporationName: string;
  allianceId?: number;
  allianceName?: string;
  factionId?: number;
  factionName?: string;
  shipTypeId: number;
  shipTypeName: string;
  weaponTypeId?: number;
  weaponTypeName?: string;
  damageDone?: number;
  finalBlow?: boolean;
}

export interface KillmailVictim extends KillmailParticipant {
  damageTaken: number;
  items?: Array<{
    typeId: number;
    typeName: string;
    quantity: number;
    singleton: boolean;
    flag: number;
    destroyed: boolean;
  }>;
}

export interface KillmailSummary {
  id: string;
  killmailId?: number;
  killmailHash?: string;
  timestamp: string;
  systemId: number;
  systemName: string;
  system?: string; // Alternative system field name
  regionId: number;
  regionName: string;
  victim: KillmailVictim;
  attackers: KillmailParticipant[];
  attackerCount: number;
  totalValue: number;
  isCorpLoss: boolean;
  isCorpKill: boolean;
  zkbUrl?: string;
}

// Dashboard analytics types
export interface DashboardStats {
  totalMembers: number;
  activeMembers: number;
  onlineMembers?: number;
  totalAssets: number;
  totalAssetsValue: number;
  activeJobs: number;
  completedJobsThisMonth: number;
  pendingJobsCount?: number;
  miningOperationsThisMonth: number;
  miningValueThisMonth: number;
  corpWalletBalance: number;
  monthlyProfit?: number;
  weeklyProfit?: number;
  marketOrders?: number;
  recentActivity: ActivityLog[];
  alerts?: Array<{
    id: string;
    type: 'warning' | 'error' | 'info';
    message: string;
    timestamp: string;
    dismissed?: boolean;
  }>;
}

export interface ActivityLog {
  id: string;
  timestamp: string;
  type: 'login' | 'logout' | 'manufacturing' | 'mining' | 'asset_update' | 'market' | 'killmail' | 'system';
  memberId?: number;
  memberName?: string;
  description: string;
  details?: Record<string, any>;
  severity?: 'low' | 'medium' | 'high' | 'critical';
}

// Role-based access control types
export type UserRole = 
  | 'super_admin'           // Full system access, can manage all corporations
  | 'corp_admin'            // Corporation administrator, can manage corp settings and users
  | 'corp_director'         // Corporation director, can view/manage corp operations
  | 'corp_manager'          // Corporation manager, can manage specific areas
  | 'corp_member'           // Basic corporation member, read-only access
  | 'guest';                // Limited guest access

export interface RolePermissions {
  // System permissions
  canManageSystem: boolean;
  canManageMultipleCorps: boolean;
  canConfigureESI: boolean;
  canManageDatabase: boolean;
  
  // Corporation permissions
  canManageCorp: boolean;
  canManageUsers: boolean;
  canViewFinancials: boolean;
  canManageManufacturing: boolean;
  canManageMining: boolean;
  canManageAssets: boolean;
  canManageMarket: boolean;
  canViewKillmails: boolean;
  canManageIncome: boolean;
  
  // Data permissions
  canViewAllMembers: boolean;
  canEditAllData: boolean;
  canExportData: boolean;
  canDeleteData: boolean;
}

export interface LMeveUser {
  // Core identity
  id: string;
  username?: string;                    // For manual logins
  characterId?: number;                 // For ESI logins
  characterName?: string;               // EVE character name
  
  // Corporation data
  corporationId?: number;
  corporationName?: string;
  allianceId?: number;
  allianceName?: string;
  
  // Authentication
  authMethod: 'manual' | 'esi';
  role: UserRole;
  permissions: RolePermissions;
  
  // ESI data (when applicable)
  accessToken?: string;
  refreshToken?: string;
  tokenExpiry?: string;
  scopes?: string[];
  characterScopes?: string[];       // Character-only scopes
  corporationScopes?: string[];     // Corporation scopes (requires corp roles)
  
  // Session management
  lastLogin: string;
  sessionExpiry: string;
  isActive: boolean;
  
  // Admin flags
  isAdmin?: boolean;
  canManageESI?: boolean;
  
  // Metadata
  createdDate: string;
  createdBy?: string;
  updatedDate: string;
  updatedBy?: string;
}

export interface ESIAuthState {
  state: string;
  verifier: string;
  challenge: string;
  timestamp: number;
  corporationId?: number;
  scopeType?: 'basic' | 'enhanced' | 'corporation';
  scopes?: string[];
}

export interface ESIConfig {
  clientId: string;
  secretKey: string;
  baseUrl: string;
  userAgent?: string;
}

export interface ESITokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}

export interface ESICharacterData {
  character_id: number;
  character_name: string;
  corporation_id: number;
  alliance_id?: number;
  scopes: string[];
}

export interface CorporationConfig {
  corporationId: number;
  corporationName: string;
  esiClientId?: string;
  esiClientSecret?: string;
  registeredScopes: string[];
  isActive: boolean;
  registrationDate: string;
  lastTokenRefresh?: string;
}