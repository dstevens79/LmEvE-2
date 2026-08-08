import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  Play,
  Upload,
  Database,
  Terminal,
  WarningCircle
} from '@phosphor-icons/react';
import { DatabaseTask } from '@/hooks/useRemoteOperations';

interface RemoteOperationsProps {
  tasks: DatabaseTask[];
  onCreateDatabases: () => Promise<void>;
  onImportSchema: (file?: File) => Promise<void>;
  onImportSDE: (file?: File) => Promise<void>;
  isConnected: boolean;
  connectionMessage: string;
  onTestConnection: () => Promise<void>;
}

export const RemoteOperations: React.FC<RemoteOperationsProps> = ({
  tasks,
  onCreateDatabases,
  onImportSchema,
  onImportSDE,
  isConnected,
  connectionMessage,
  onTestConnection
}) => {
  const [selectedFiles, setSelectedFiles] = React.useState<{
    schema?: File;
    sde?: File;
  }>({});

  const getStatusIcon = (status: DatabaseTask['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle size={16} className="text-green-500" />;
      case 'failed':
        return <XCircle size={16} className="text-red-500" />;
      case 'running':
        return <Clock size={16} className="text-blue-500 animate-spin" />;
      default:
        return <Clock size={16} className="text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: DatabaseTask['status']) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'failed':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      case 'running':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const handleFileChange = (type: 'schema' | 'sde', file: File | undefined) => {
    setSelectedFiles(prev => ({
      ...prev,
      [type]: file
    }));
  };

  const recentTasks = tasks.slice(-5).reverse();

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Terminal size={20} />
            Remote Database Connection
          </CardTitle>
          <CardDescription>
            Secure connection to database server for privileged operations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Badge className={isConnected ? getStatusColor('completed') : getStatusColor('failed')}>
              {isConnected ? (
                <>
                  <CheckCircle size={12} className="mr-1" />
                  Connected
                </>
              ) : (
                <>
                  <XCircle size={12} className="mr-1" />
                  Disconnected
                </>
              )}
            </Badge>
            <span className="text-sm text-muted-foreground">{connectionMessage}</span>
          </div>
          
          <Button onClick={onTestConnection} variant="outline" size="sm">
            Test Connection
          </Button>
        </CardContent>
      </Card>

      {/* Database Operations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database size={20} />
            Database Setup Operations
          </CardTitle>
          <CardDescription>
            Automated database setup and maintenance operations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Create Databases */}
          <div className="space-y-3">
            <h4 className="font-medium">1. Create Databases & User</h4>
            <p className="text-sm text-muted-foreground">
              Creates the 'lmeve' and 'EveStaticData' databases with proper user permissions
            </p>
            <Button 
              onClick={onCreateDatabases} 
              disabled={!isConnected}
              className="w-full sm:w-auto"
            >
              <Database size={16} className="mr-2" />
              Create Databases
            </Button>
          </div>

          {/* Import Schema */}
          <div className="space-y-3 pt-4 border-t border-border">
            <h4 className="font-medium">2. Import LMeve Schema</h4>
            <p className="text-sm text-muted-foreground">
              Imports the LMeve application schema into the lmeve database
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <input
                  type="file"
                  accept=".sql"
                  onChange={(e) => handleFileChange('schema', e.target.files?.[0])}
                  className="w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-muted file:text-muted-foreground hover:file:bg-muted/80"
                />
              </div>
              <Button 
                onClick={() => onImportSchema(selectedFiles.schema)}
                disabled={!isConnected}
                variant="outline"
              >
                <Upload size={16} className="mr-2" />
                Import Schema
              </Button>
            </div>
          </div>

          {/* Import SDE */}
          <div className="space-y-3 pt-4 border-t border-border">
            <h4 className="font-medium">3. Import EVE Static Data</h4>
            <p className="text-sm text-muted-foreground">
              Imports EVE Static Data Export into the EveStaticData database
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <input
                  type="file"
                  accept=".sql,.tar.bz2,.tar.gz"
                  onChange={(e) => handleFileChange('sde', e.target.files?.[0])}
                  className="w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-muted file:text-muted-foreground hover:file:bg-muted/80"
                />
              </div>
              <Button 
                onClick={() => onImportSDE(selectedFiles.sde)}
                disabled={!isConnected}
                variant="outline"
              >
                <Upload size={16} className="mr-2" />
                Import SDE
              </Button>
            </div>
            <div className="text-xs text-muted-foreground">
              Supports: .sql, .tar.bz2, .tar.gz files
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Tasks */}
      {recentTasks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock size={20} />
              Recent Operations
            </CardTitle>
            <CardDescription>
              Latest database operation tasks and their status
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-64">
              <div className="space-y-3">
                {recentTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-start gap-3 p-3 rounded-lg border border-border"
                  >
                    <div className="mt-0.5">
                      {getStatusIcon(task.status)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm capitalize">
                          {task.type.replace('-', ' ')}
                        </span>
                        <Badge className={`text-xs ${getStatusColor(task.status)}`}>
                          {task.status}
                        </Badge>
                      </div>
                      
                      {task.status === 'running' && (
                        <div className="mb-2">
                          <Progress value={task.progress} className="h-2" />
                          <div className="text-xs text-muted-foreground mt-1">
                            {task.progress}% complete
                          </div>
                        </div>
                      )}
                      
                      {task.logs.length > 0 && (
                        <div className="text-xs text-muted-foreground">
                          {task.logs[task.logs.length - 1]}
                        </div>
                      )}
                      
                      {task.error && (
                        <div className="text-xs text-red-500 mt-1 flex items-center gap-1">
                          <WarningCircle size={12} />
                          {task.error}
                        </div>
                      )}
                      
                      <div className="text-xs text-muted-foreground mt-1">
                        {task.startTime && (
                          <>Started: {task.startTime.toLocaleTimeString()}</>
                        )}
                        {task.endTime && (
                          <> • Completed: {task.endTime.toLocaleTimeString()}</>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Help */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <WarningCircle size={20} />
            Setup Requirements
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <div>
            <strong>Database Server Setup:</strong>
          </div>
          <ol className="list-decimal list-inside space-y-1 ml-2">
            <li>Install database operation scripts: <code className="text-xs bg-muted px-1 py-0.5 rounded">sudo ./install.sh</code></li>
            <li>Configure SSH keys for secure connection</li>
            <li>Test connection using the "Test Connection" button above</li>
          </ol>
          <div className="mt-3">
            <strong>Security:</strong> All operations run through secure SSH with limited sudo privileges.
          </div>
        </CardContent>
      </Card>
    </div>
  );
};