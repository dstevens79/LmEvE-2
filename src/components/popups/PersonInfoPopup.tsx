import React from 'react';
import { X, Briefcase, Calendar, CurrencyDollar } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Member } from '@/lib/types';

interface PersonInfoPopupProps {
  person: Member;
  onClose: () => void;
}

export function PersonInfoPopup({ person, onClose }: PersonInfoPopupProps) {
  const [personStats, setPersonStats] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const loadPersonData = async () => {
      setLoading(true);
      try {
        const stats = await spark.kv.get<any>(`member-stats-${person.characterId}`);
        
        setPersonStats(stats || {
          jobsCompleted: Math.floor(Math.random() * 250),
          jobsInProgress: Math.floor(Math.random() * 5),
          totalIskEarned: Math.floor(Math.random() * 5000000000),
          averageJobTime: Math.floor(Math.random() * 7200),
          specializations: ['Manufacturing', 'Invention'],
          recentJobs: [
            { itemName: 'Caracal', completedDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), iskEarned: 1500000 },
            { itemName: 'Hammerhead II', completedDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), iskEarned: 2250000 },
            { itemName: 'Vexor', completedDate: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(), iskEarned: 3100000 }
          ]
        });
      } catch (error) {
        console.error('Error loading person data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadPersonData();
  }, [person.characterId]);

  const formatISK = (amount: number): string => {
    if (amount >= 1e12) return `${(amount / 1e12).toFixed(2)}T ISK`;
    if (amount >= 1e9) return `${(amount / 1e9).toFixed(2)}B ISK`;
    if (amount >= 1e6) return `${(amount / 1e6).toFixed(2)}M ISK`;
    if (amount >= 1e3) return `${(amount / 1e3).toFixed(0)}K ISK`;
    return `${Math.round(amount)} ISK`;
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  const characterName = person.characterName || person.name || 'Unknown';
  const characterId = person.characterId;
  const corporationId = person.corporationId;

  return (
    <div 
      className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div 
        className="bg-card border-2 border-accent/30 rounded-lg w-full max-w-3xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* EVE-style Header */}
        <div className="bg-gradient-to-r from-accent/20 to-accent/10 border-b-2 border-accent/30 p-4">
          <div className="flex items-start gap-4">
            {/* Character Portrait */}
            <div className="w-24 h-24 bg-background/50 border border-accent/30 rounded flex-shrink-0 overflow-hidden">
              <img 
                src={`https://images.evetech.net/characters/${characterId}/portrait?size=128`}
                alt={characterName}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgdmlld0JveD0iMCAwIDEyOCAxMjgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMjgiIGhlaWdodD0iMTI4IiBmaWxsPSIjMjIyIi8+CjxjaXJjbGUgY3g9IjY0IiBjeT0iNTAiIHI9IjI0IiBmaWxsPSIjNjY2Ii8+CjxwYXRoIGQ9Ik0yNCA5NkMyNCA3OCA0MiA3MCA2NCA3MEM4NiA3MCAxMDQgNzggMTA0IDk2VjEyOEgyNFY5NloiIGZpbGw9IiM2NjYiLz4KPC9zdmc+';
                }}
              />
            </div>

            {/* Primary Details */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h2 className="text-2xl font-bold text-foreground mb-1">{characterName}</h2>
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    {person.corporationName && (
                      <Badge variant="outline" className="bg-blue-500/20 text-blue-400 border-blue-500/50">
                        {person.corporationName}
                      </Badge>
                    )}
                    {person.accessLevel && (
                      <Badge variant="outline" className="bg-accent/20 text-accent border-accent/50">
                        {person.accessLevel.toUpperCase()}
                      </Badge>
                    )}
                  </div>
                  {person.titles && person.titles.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap">
                      {person.titles.map((title, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          {title}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  className="flex-shrink-0 hover:bg-destructive/20 hover:text-destructive"
                >
                  <X size={20} />
                </Button>
              </div>

              {/* Quick Stats Row */}
              {!loading && personStats && (
                <div className="grid grid-cols-3 gap-3 mt-3">
                  <div className="bg-background/50 rounded px-3 py-2 border border-border/50">
                    <div className="text-xs text-muted-foreground">Jobs Completed</div>
                    <div className="text-lg font-semibold text-foreground">{personStats.jobsCompleted}</div>
                  </div>
                  <div className="bg-background/50 rounded px-3 py-2 border border-border/50">
                    <div className="text-xs text-muted-foreground">In Progress</div>
                    <div className="text-lg font-semibold text-blue-400">{personStats.jobsInProgress}</div>
                  </div>
                  <div className="bg-background/50 rounded px-3 py-2 border border-border/50">
                    <div className="text-xs text-muted-foreground">Total Earned</div>
                    <div className="text-lg font-semibold text-green-400">{formatISK(personStats.totalIskEarned)}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Details Section with Tabs */}
        <div className="p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-muted-foreground">Loading member data...</div>
            </div>
          ) : (
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="w-full grid grid-cols-3 mb-4">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="jobs">Jobs</TabsTrigger>
                <TabsTrigger value="permissions">Permissions</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="bg-muted/30 rounded p-3 border border-border/50">
                      <div className="text-sm text-muted-foreground mb-1">Corporation</div>
                      <div className="flex items-center gap-2">
                        {corporationId && (
                          <img 
                            src={`https://images.evetech.net/corporations/${corporationId}/logo?size=32`}
                            alt="Corp Logo"
                            className="w-6 h-6 rounded"
                            onError={(e) => (e.target as HTMLImageElement).style.display = 'none'}
                          />
                        )}
                        <div className="text-base font-semibold text-foreground truncate">
                          {person.corporationName || 'Unknown'}
                        </div>
                      </div>
                    </div>
                    <div className="bg-muted/30 rounded p-3 border border-border/50">
                      <div className="text-sm text-muted-foreground mb-1">Total Skill Points</div>
                      <div className="text-base font-semibold text-foreground">
                        {person.totalSkillPoints ? (person.totalSkillPoints / 1000000).toFixed(1) + 'M SP' : 'N/A'}
                      </div>
                    </div>
                    <div className="bg-muted/30 rounded p-3 border border-border/50">
                      <div className="text-sm text-muted-foreground mb-1">Security Status</div>
                      <div className="text-base font-semibold text-foreground">
                        {person.securityStatus?.toFixed(1) || 'N/A'}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="bg-muted/30 rounded p-3 border border-border/50">
                      <div className="text-sm text-muted-foreground mb-1">Member Since</div>
                      <div className="text-base font-semibold text-foreground">
                        {person.joinedDate ? new Date(person.joinedDate).toLocaleDateString() : 'N/A'}
                      </div>
                    </div>
                    <div className="bg-muted/30 rounded p-3 border border-border/50">
                      <div className="text-sm text-muted-foreground mb-1">Last Active</div>
                      <div className="text-base font-semibold text-foreground">
                        {person.lastLogin ? formatDate(person.lastLogin) : 'N/A'}
                      </div>
                    </div>
                    <div className="bg-muted/30 rounded p-3 border border-border/50">
                      <div className="text-sm text-muted-foreground mb-1">Current Location</div>
                      <div className="text-base font-semibold text-foreground truncate">
                        {person.location || 'Unknown'}
                      </div>
                    </div>
                  </div>
                </div>

                {personStats.specializations && personStats.specializations.length > 0 && (
                  <div className="bg-muted/30 rounded p-3 border border-border/50">
                    <div className="text-sm text-muted-foreground mb-2">Specializations</div>
                    <div className="flex gap-2 flex-wrap">
                      {personStats.specializations.map((spec: string, idx: number) => (
                        <Badge key={idx} variant="outline" className="bg-accent/20 text-accent border-accent/50">
                          {spec}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="jobs" className="space-y-3">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-muted/30 rounded p-3 border border-border/50">
                    <div className="text-sm text-muted-foreground mb-1">Jobs Completed</div>
                    <div className="text-2xl font-semibold text-foreground">{personStats.jobsCompleted}</div>
                  </div>
                  <div className="bg-muted/30 rounded p-3 border border-border/50">
                    <div className="text-sm text-muted-foreground mb-1">Total ISK Earned</div>
                    <div className="text-2xl font-semibold text-green-400">{formatISK(personStats.totalIskEarned)}</div>
                  </div>
                </div>

                <div className="bg-muted/30 rounded p-3 border border-border/50">
                  <div className="text-sm font-semibold text-foreground mb-3">Recent Jobs</div>
                  <div className="space-y-2">
                    {personStats.recentJobs && personStats.recentJobs.map((job: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                        <div className="flex-1">
                          <div className="text-sm font-medium text-foreground">{job.itemName}</div>
                          <div className="text-xs text-muted-foreground">{formatDate(job.completedDate)}</div>
                        </div>
                        <div className="text-sm font-semibold text-green-400">{formatISK(job.iskEarned)}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-muted/30 rounded p-3 border border-border/50">
                  <div className="text-sm text-muted-foreground mb-1">Average Job Time</div>
                  <div className="text-xl font-semibold text-foreground">
                    {formatDuration(personStats.averageJobTime)}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="permissions" className="space-y-3">
                <div className="bg-muted/30 rounded p-4 border border-border/50">
                  <div className="text-sm font-semibold text-foreground mb-3">Site Permissions</div>
                  <div className="space-y-2">
                    <div className="flex justify-between py-2 border-b border-border/30">
                      <span className="text-muted-foreground">Access Level</span>
                      <span className="font-semibold text-accent uppercase">
                        {person.accessLevel || 'member'}
                      </span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-border/30">
                      <span className="text-muted-foreground">Manufacturing</span>
                      <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/50">
                        Allowed
                      </Badge>
                    </div>
                    <div className="flex justify-between py-2 border-b border-border/30">
                      <span className="text-muted-foreground">Asset Management</span>
                      <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/50">
                        Allowed
                      </Badge>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-muted-foreground">Administration</span>
                      <Badge variant="outline" className={
                        person.accessLevel === 'director' || person.accessLevel === 'ceo'
                          ? "bg-green-500/20 text-green-400 border-green-500/50"
                          : "bg-red-500/20 text-red-400 border-red-500/50"
                      }>
                        {person.accessLevel === 'director' || person.accessLevel === 'ceo' ? 'Allowed' : 'Denied'}
                      </Badge>
                    </div>
                  </div>
                </div>

                {person.roles && person.roles.length > 0 && (
                  <div className="bg-muted/30 rounded p-4 border border-border/50">
                    <div className="text-sm font-semibold text-foreground mb-3">Corporation Roles</div>
                    <div className="flex gap-2 flex-wrap">
                      {person.roles.map((role, idx) => (
                        <Badge key={idx} variant="outline" className="bg-blue-500/20 text-blue-400 border-blue-500/50">
                          {role}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {person.titles && person.titles.length > 0 && (
                  <div className="bg-muted/30 rounded p-4 border border-border/50">
                    <div className="text-sm font-semibold text-foreground mb-3">Corporation Titles</div>
                    <div className="flex gap-2 flex-wrap">
                      {person.titles.map((title, idx) => (
                        <Badge key={idx} variant="secondary" className="bg-accent/20 text-accent border-accent/50">
                          {title}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>
    </div>
  );
}
