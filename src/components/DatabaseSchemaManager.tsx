import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Database, 
  Table, 
  Download, 
  FileText, 
  Copy,
  Check,
  Warning,
  Info,
  Gear,
  Code
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import { lmeveSchemas, generateCreateTableSQL, generateAllCreateTableSQL, defaultSystemSettings, type DatabaseSchema } from '@/lib/database-schemas';

interface DatabaseSchemaManagerProps {
  className?: string;
}

export function DatabaseSchemaManager({ className }: DatabaseSchemaManagerProps) {
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [copiedSql, setCopiedSql] = useState<string>('');
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());

  // Get table statistics
  const getSchemaStats = () => {
    const totalTables = lmeveSchemas.length;
    const totalColumns = lmeveSchemas.reduce((sum, schema) => sum + schema.columns.length, 0);
    const totalIndexes = lmeveSchemas.reduce((sum, schema) => sum + (schema.indexes?.length || 0), 0);
    const totalForeignKeys = lmeveSchemas.reduce((sum, schema) => sum + (schema.foreignKeys?.length || 0), 0);

    return { totalTables, totalColumns, totalIndexes, totalForeignKeys };
  };

  const stats = getSchemaStats();

  // Copy SQL to clipboard
  const copyToClipboard = async (text: string, label: string = 'SQL') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSql(label);
      toast.success(`${label} copied to clipboard`);
      setTimeout(() => setCopiedSql(''), 2000);
    } catch (error) {
      toast.error('Failed to copy to clipboard');
    }
  };

  // Toggle table details
  const toggleTableDetails = (tableName: string) => {
    const newExpanded = new Set(expandedTables);
    if (newExpanded.has(tableName)) {
      newExpanded.delete(tableName);
    } else {
      newExpanded.add(tableName);
    }
    setExpandedTables(newExpanded);
  };

  // Generate table creation SQL for selected table
  const getTableSQL = (schema: DatabaseSchema): string => {
    try {
      return generateCreateTableSQL(schema);
    } catch (error) {
      return `-- Error generating SQL for table ${schema.tableName}: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  };

  // Download SQL file
  const downloadSQL = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/sql' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Downloaded ${filename}`);
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Database size={24} className="text-accent" />
            Database Schema Manager
          </h2>
          <p className="text-muted-foreground">
            Complete LMeve database structure based on the original project
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => downloadSQL(generateAllCreateTableSQL(), 'lmeve_schema.sql')}
            variant="outline"
          >
            <Download size={16} className="mr-2" />
            Download Full Schema
          </Button>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tables</CardTitle>
            <Table className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalTables}</div>
            <p className="text-xs text-muted-foreground">Database tables</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Columns</CardTitle>
            <Gear className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalColumns}</div>
            <p className="text-xs text-muted-foreground">Total columns</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Indexes</CardTitle>
            <Code className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalIndexes}</div>
            <p className="text-xs text-muted-foreground">Performance indexes</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Foreign Keys</CardTitle>
            <Warning className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalForeignKeys}</div>
            <p className="text-xs text-muted-foreground">Relationships</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="tables" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="tables">Tables & Structure</TabsTrigger>
          <TabsTrigger value="sql">SQL Generator</TabsTrigger>
          <TabsTrigger value="settings">Default Data</TabsTrigger>
        </TabsList>

        {/* Tables Tab */}
        <TabsContent value="tables" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Database Tables</CardTitle>
              <CardDescription>
                Complete table structure for LMeve corporation management system
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {lmeveSchemas.map((schema, index) => (
                  <div key={schema.tableName} className="border rounded-lg">
                    <div 
                      className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50"
                      onClick={() => toggleTableDetails(schema.tableName)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-accent/20 text-accent font-mono text-sm">
                          {index + 1}
                        </div>
                        <div>
                          <h4 className="font-semibold">{schema.tableName}</h4>
                          <div className="flex gap-2 mt-1">
                            <Badge variant="secondary" className="text-xs">
                              {schema.columns.length} columns
                            </Badge>
                            {schema.indexes && (
                              <Badge variant="outline" className="text-xs">
                                {schema.indexes.length} indexes
                              </Badge>
                            )}
                            {schema.foreignKeys && schema.foreignKeys.length > 0 && (
                              <Badge variant="outline" className="text-xs">
                                {schema.foreignKeys.length} FK
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            copyToClipboard(getTableSQL(schema), `${schema.tableName} SQL`);
                          }}
                        >
                          {copiedSql === `${schema.tableName} SQL` ? (
                            <Check size={14} className="text-green-500" />
                          ) : (
                            <Copy size={14} />
                          )}
                        </Button>
                      </div>
                    </div>

                    {expandedTables.has(schema.tableName) && (
                      <div className="border-t">
                        <div className="p-4 space-y-4">
                          {/* Columns */}
                          <div>
                            <h5 className="font-medium mb-2">Columns ({schema.columns.length})</h5>
                            <div className="space-y-2">
                              {schema.columns.map((column) => (
                                <div key={column.name} className="flex items-center justify-between py-2 px-3 bg-muted/30 rounded text-sm">
                                  <div className="flex items-center gap-3">
                                    <code className="font-mono font-medium">{column.name}</code>
                                    <Badge variant="outline" className="text-xs">
                                      {column.type}{column.size ? `(${column.size})` : ''}
                                    </Badge>
                                    {column.primaryKey && <Badge className="text-xs bg-yellow-500/20 text-yellow-700">PK</Badge>}
                                    {column.nullable === false && <Badge variant="destructive" className="text-xs">NOT NULL</Badge>}
                                    {column.unique && <Badge className="text-xs bg-blue-500/20 text-blue-700">UNIQUE</Badge>}
                                    {column.autoIncrement && <Badge className="text-xs bg-green-500/20 text-green-700">AUTO</Badge>}
                                  </div>
                                  {column.defaultValue && (
                                    <code className="text-xs text-muted-foreground">
                                      DEFAULT: {column.defaultValue}
                                    </code>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Indexes */}
                          {schema.indexes && schema.indexes.length > 0 && (
                            <div>
                              <h5 className="font-medium mb-2">Indexes ({schema.indexes.length})</h5>
                              <div className="space-y-2">
                                {schema.indexes.map((index) => (
                                  <div key={index.name} className="flex items-center justify-between py-2 px-3 bg-muted/30 rounded text-sm">
                                    <div className="flex items-center gap-3">
                                      <code className="font-mono">{index.name}</code>
                                      <Badge variant="outline" className="text-xs">{index.type}</Badge>
                                    </div>
                                    <code className="text-xs text-muted-foreground">
                                      ({index.columns.join(', ')})
                                    </code>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Foreign Keys */}
                          {schema.foreignKeys && schema.foreignKeys.length > 0 && (
                            <div>
                              <h5 className="font-medium mb-2">Foreign Keys ({schema.foreignKeys.length})</h5>
                              <div className="space-y-2">
                                {schema.foreignKeys.map((fk) => (
                                  <div key={fk.name} className="flex items-center justify-between py-2 px-3 bg-muted/30 rounded text-sm">
                                    <div className="flex items-center gap-3">
                                      <code className="font-mono">{fk.name}</code>
                                    </div>
                                    <code className="text-xs text-muted-foreground">
                                      {fk.column} â†’ {fk.referencedTable}.{fk.referencedColumn}
                                    </code>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SQL Generator Tab */}
        <TabsContent value="sql" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>SQL Schema Generator</CardTitle>
              <CardDescription>
                Generate CREATE TABLE statements for LMeve database setup
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button
                  onClick={() => copyToClipboard(generateAllCreateTableSQL(), 'Complete Schema')}
                  className="flex-1"
                >
                  {copiedSql === 'Complete Schema' ? (
                    <Check size={16} className="mr-2 text-green-500" />
                  ) : (
                    <Copy size={16} className="mr-2" />
                  )}
                  Copy All Tables SQL
                </Button>
                <Button
                  onClick={() => downloadSQL(generateAllCreateTableSQL(), 'lmeve_complete_schema.sql')}
                  variant="outline"
                >
                  <Download size={16} className="mr-2" />
                  Download
                </Button>
              </div>

              <div className="border rounded-lg">
                <div className="p-3 bg-muted/50 border-b flex items-center gap-2">
                  <FileText size={16} />
                  <span className="font-medium">Complete LMeve Database Schema</span>
                </div>
                <ScrollArea className="h-96">
                  <pre className="p-4 text-sm bg-card font-mono overflow-x-auto">
                    {generateAllCreateTableSQL()}
                  </pre>
                </ScrollArea>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Default Settings Tab */}
        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Default System Settings</CardTitle>
              <CardDescription>
                Initial configuration data for LMeve system setup
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    const settingsSQL = `INSERT INTO system_settings (setting_key, setting_value, setting_type, category, description) VALUES\n${defaultSystemSettings.map(setting => 
                      `  ('${setting.key}', '${setting.value}', '${setting.type}', '${setting.category}', '${setting.description}')`
                    ).join(',\n')};`;
                    copyToClipboard(settingsSQL, 'Settings SQL');
                  }}
                  className="flex-1"
                >
                  {copiedSql === 'Settings SQL' ? (
                    <Check size={16} className="mr-2 text-green-500" />
                  ) : (
                    <Copy size={16} className="mr-2" />
                  )}
                  Copy Settings SQL
                </Button>
              </div>

              <div className="space-y-3">
                {Object.entries(
                  defaultSystemSettings.reduce((groups, setting) => {
                    if (!groups[setting.category]) groups[setting.category] = [];
                    groups[setting.category].push(setting);
                    return groups;
                  }, {} as Record<string, typeof defaultSystemSettings>)
                ).map(([category, settings]) => (
                  <div key={category} className="border rounded-lg p-4">
                    <h4 className="font-semibold mb-3 capitalize flex items-center gap-2">
                      <Info size={16} />
                      {category.replace('_', ' ')} Settings
                    </h4>
                    <div className="grid gap-2">
                      {settings.map((setting) => (
                        <div key={setting.key} className="flex justify-between items-center py-2 px-3 bg-muted/30 rounded text-sm">
                          <div className="flex flex-col">
                            <code className="font-mono font-medium">{setting.key}</code>
                            <span className="text-xs text-muted-foreground">{setting.description}</span>
                          </div>
                          <div className="flex items-center gap-2 text-right">
                            <Badge variant="outline" className="text-xs">{setting.type}</Badge>
                            <code className="text-xs">{setting.value || 'null'}</code>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}