'use client';
import { useEffect, useState } from 'react';
import { createId } from '@paralleldrive/cuid2';
import { createId } from '@paralleldrive/cuid2';

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

interface TableRow {
  [key: string]: any;
}

interface TableSchema {
  name: string;
  columns: Array<{
    name: string;
    type: string;
    nullable: boolean;
    primary_key: boolean;
    auto_generated?: boolean;
  }>;
}

export default function AdminDbPage() {
  const [token, setToken] = useState('change-me');
  const [tables, setTables] = useState<TableSchema[]>([]);
  const [sql, setSql] = useState('');
  const [rows, setRows] = useState<any[] | null>(null);
  const [execResult, setExecResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'gui' | 'sql'>('gui');

  // GUI state
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [tableData, setTableData] = useState<TableRow[]>([]);
  const [editingRow, setEditingRow] = useState<TableRow | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState<TableRow>({});

  const loadSchema = async () => {
    setError(null);
    try {
      const res = await fetch(`${apiBase}/api/v1/admin/db/schema`, { headers: { 'x-admin-token': token } });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'request_failed');
      setTables(json.tables || []);
      if (json.tables?.length > 0 && !selectedTable) {
        setSelectedTable(json.tables[0].name);
      }
      if (json.tables?.length > 0 && !selectedTable) {
        setSelectedTable(json.tables[0].name);
      }
    } catch (e: any) { setError(e.message); }
  };

  const loadTableData = async (tableName: string) => {
    if (!tableName) return;
    setError(null);
    try {
      const res = await fetch(`${apiBase}/api/v1/admin/db/preview`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-admin-token': token },
        body: JSON.stringify({ sql: `SELECT * FROM ${tableName} ORDER BY rowid DESC LIMIT 100` })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || json.error || 'request_failed');
      setTableData(json.rows || []);
    } catch (e: any) {
      setError(e.message);
      setTableData([]);
    }
  };

  const getTableSchema = (tableName: string): TableSchema | undefined => {
    return tables.find(t => t.name === tableName);
  };

  // Fallback function to get default columns when schema is not available
  const getDefaultColumns = (tableName: string) => {
    const defaultSchemas: Record<string, { name: string; type: string; nullable: boolean; primary_key: boolean; auto_generated?: boolean }[]> = {
      'Project': [
        { name: 'id', type: 'TEXT', nullable: false, primary_key: true, auto_generated: true },
        { name: 'key', type: 'TEXT', nullable: false, primary_key: false },
        { name: 'createdAt', type: 'DATETIME', nullable: true, primary_key: false, auto_generated: true },
        { name: 'updatedAt', type: 'DATETIME', nullable: true, primary_key: false, auto_generated: true }
      ],
      'TestRun': [
        { name: 'id', type: 'TEXT', nullable: false, primary_key: true, auto_generated: true },
        { name: 'projectId', type: 'TEXT', nullable: false, primary_key: false },
        { name: 'suite', type: 'TEXT', nullable: false, primary_key: false },
        { name: 'env', type: 'TEXT', nullable: true, primary_key: false },
        { name: 'branch', type: 'TEXT', nullable: true, primary_key: false },
        { name: 'commit', type: 'TEXT', nullable: true, primary_key: false },
        { name: 'ciBuildId', type: 'TEXT', nullable: true, primary_key: false },
        { name: 'startedAt', type: 'DATETIME', nullable: false, primary_key: false },
        { name: 'finishedAt', type: 'DATETIME', nullable: false, primary_key: false },
        { name: 'durationMs', type: 'INTEGER', nullable: false, primary_key: false },
        { name: 'coveragePct', type: 'REAL', nullable: true, primary_key: false },
        { name: 'passCount', type: 'INTEGER', nullable: false, primary_key: false, auto_generated: true },
        { name: 'failCount', type: 'INTEGER', nullable: false, primary_key: false, auto_generated: true },
        { name: 'skipCount', type: 'INTEGER', nullable: false, primary_key: false, auto_generated: true },
        { name: 'totalCount', type: 'INTEGER', nullable: false, primary_key: false, auto_generated: true },
        { name: 'reportFilename', type: 'TEXT', nullable: true, primary_key: false },
        { name: 'reportUrl', type: 'TEXT', nullable: true, primary_key: false },
        { name: 'createdAt', type: 'DATETIME', nullable: true, primary_key: false, auto_generated: true },
        { name: 'updatedAt', type: 'DATETIME', nullable: true, primary_key: false, auto_generated: true }
      ],
      'TestCase': [
        { name: 'id', type: 'TEXT', nullable: false, primary_key: true, auto_generated: true },
        { name: 'runId', type: 'TEXT', nullable: false, primary_key: false },
        { name: 'name', type: 'TEXT', nullable: false, primary_key: false },
        { name: 'status', type: 'TEXT', nullable: false, primary_key: false },
        { name: 'durationMs', type: 'INTEGER', nullable: false, primary_key: false },
        { name: 'errorMessage', type: 'TEXT', nullable: true, primary_key: false },
        { name: 'browser', type: 'TEXT', nullable: true, primary_key: false },
        { name: 'tagsJson', type: 'TEXT', nullable: true, primary_key: false },
        { name: 'createdAt', type: 'DATETIME', nullable: true, primary_key: false, auto_generated: true },
        { name: 'updatedAt', type: 'DATETIME', nullable: true, primary_key: false, auto_generated: true }
      ],
      'TestAutoCoverage': [
        { name: 'id', type: 'TEXT', nullable: false, primary_key: true, auto_generated: true },
        { name: 'projectId', type: 'TEXT', nullable: false, primary_key: false },
        { name: 'autoTestCovered', type: 'INTEGER', nullable: false, primary_key: false },
        { name: 'manualTestCovered', type: 'INTEGER', nullable: false, primary_key: false },
        { name: 'total', type: 'INTEGER', nullable: false, primary_key: false },
        { name: 'createdAt', type: 'DATETIME', nullable: true, primary_key: false, auto_generated: true }
      ]
    };

    return defaultSchemas[tableName] || [
      { name: 'id', type: 'TEXT', nullable: false, primary_key: true, auto_generated: true },
      { name: 'name', type: 'TEXT', nullable: false, primary_key: false }
    ];
  };

  // Get columns for form rendering (with fallback)
  const getFormColumns = (tableName: string) => {
    const schema = getTableSchema(tableName);
    return schema?.columns || getDefaultColumns(tableName);
  };

  const initFormData = (tableName: string, existingRow?: TableRow) => {
    const columns = getFormColumns(tableName);
    const data: TableRow = {};

    columns.forEach(col => {
      if (existingRow && existingRow[col.name] !== undefined) {
        let value = existingRow[col.name];
        // Convert ISO datetime to datetime-local format for editing
        if (col.type.toLowerCase().includes('date') && value) {
          const dateValue = new Date(value);
          if (!isNaN(dateValue.getTime())) {
            value = dateValue.toISOString().slice(0, 16);
          } else {
            value = existingRow[col.name]; // Keep original if conversion fails
          }
        }
        data[col.name] = value;
      } else if (col.auto_generated) {
        // Skip auto-generated fields for new records
        return;
      } else if (col.primary_key) {
        // For new records, don't set primary key values (let server generate them)
        // Only set if editing existing record
        data[col.name] = '';
      } else if (col.type.toLowerCase().includes('int')) {
        data[col.name] = '';
      } else if (col.type.toLowerCase().includes('real') || col.type.toLowerCase().includes('numeric')) {
        data[col.name] = '';
      } else if (col.type.toLowerCase().includes('date')) {
        // For datetime-local input, we need YYYY-MM-DDTHH:MM format
        const now = new Date();
        data[col.name] = now.toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM
      } else {
        data[col.name] = '';
      }
    });
    return data;
  };

  const handleCreateNew = () => {
    setIsCreating(true);
    setEditingRow(null);
    setFormData(initFormData(selectedTable));
  };

  const handleEdit = (row: TableRow) => {
    setEditingRow(row);
    setIsCreating(false);
    setFormData(initFormData(selectedTable, row));
  };

  const handleSave = async () => {
    if (!selectedTable) return;
    setError(null);

    try {
      const columns = getFormColumns(selectedTable); // Use fallback-aware function
      let sql = '';
      const values: string[] = [];

      if (isCreating) {
        // INSERT - prepare data with auto-generated values
        const insertData = { ...formData };

        // Generate auto-generated fields
        columns.forEach(col => {
          if (col.auto_generated) {
            if (col.name === 'id') {
              insertData[col.name] = createId();
            } else if (col.name.toLowerCase().includes('createdat')) {
              insertData[col.name] = new Date().toISOString();
            } else if (col.name.toLowerCase().includes('updatedat')) {
              insertData[col.name] = new Date().toISOString();
            } else if (['passCount', 'failCount', 'skipCount', 'totalCount'].includes(col.name)) {
              insertData[col.name] = 0; // Default value for count fields
            }
          }
        });

        const nonEmptyColumns = columns.filter(col =>
          insertData[col.name] !== '' &&
          insertData[col.name] !== undefined
        );
        const columnNames = nonEmptyColumns.map(col => col.name);

        columnNames.forEach(col => {
          let value = insertData[col];
          if (value === '') {
            values.push('NULL');
          } else if (typeof value === 'string') {
            values.push(`'${value.replace(/'/g, "''")}'`);
          } else {
            values.push(String(value));
          }
        });

        sql = `INSERT INTO ${selectedTable} (${columnNames.join(', ')}) VALUES (${values.join(', ')})`;
      } else {
        // UPDATE
        const setParts: string[] = [];
        const primaryKey = columns.find(col => col.primary_key);

        if (!primaryKey) throw new Error('No primary key found for updates');

        columns.forEach(col => {
          if (col.name !== primaryKey.name) {
            let value = formData[col.name];
            if (value === '') {
              setParts.push(`${col.name} = NULL`);
            } else if (typeof value === 'string') {
              setParts.push(`${col.name} = '${value.replace(/'/g, "''")}'`);
            } else {
              setParts.push(`${col.name} = ${value}`);
            }
          }
        });

        let whereValue = editingRow?.[primaryKey.name];
        if (typeof whereValue === 'string') {
          whereValue = `'${whereValue.replace(/'/g, "''")}'`;
        }

        sql = `UPDATE ${selectedTable} SET ${setParts.join(', ')} WHERE ${primaryKey.name} = ${whereValue}`;
      }

      const res = await fetch(`${apiBase}/api/v1/admin/db/execute`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-admin-token': token },
        body: JSON.stringify({ sql })
      });

      const json = await res.json();
      if (!res.ok) {
        console.error('SQL that failed:', sql); // Debug logging
        throw new Error(json.message || json.error || 'request_failed');
      }

      // Refresh data
      await loadTableData(selectedTable);
      setIsCreating(false);
      setEditingRow(null);
      setFormData({});

    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleDelete = async (row: TableRow) => {
    if (!selectedTable || !confirm('Are you sure you want to delete this record?')) return;
    setError(null);

    try {
      const columns = getFormColumns(selectedTable); // Use fallback-aware function
      const primaryKey = columns.find(col => col.primary_key);
      if (!primaryKey) throw new Error('No primary key found for deletion');

      let whereValue = row[primaryKey.name];
      if (typeof whereValue === 'string') {
        whereValue = `'${whereValue.replace(/'/g, "''")}'`;
      }

      const sql = `DELETE FROM ${selectedTable} WHERE ${primaryKey.name} = ${whereValue}`;

      const res = await fetch(`${apiBase}/api/v1/admin/db/execute`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-admin-token': token },
        body: JSON.stringify({ sql })
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.message || json.error || 'request_failed');

      await loadTableData(selectedTable);

    } catch (e: any) {
      setError(e.message);
    }
  };

  const preview = async () => {
    setError(null); setRows(null); setExecResult(null);
    try {
      const res = await fetch(`${apiBase}/api/v1/admin/db/preview`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-admin-token': token }, body: JSON.stringify({ sql }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || json.error || 'request_failed');
      setRows(json.rows);
    } catch (e: any) { setError(e.message); }
  };

  const execute = async () => {
    setError(null); setRows(null); setExecResult(null);
    try {
      const res = await fetch(`${apiBase}/api/v1/admin/db/execute`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-admin-token': token }, body: JSON.stringify({ sql }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || json.error || 'request_failed');
      setExecResult(json.result);
      await loadSchema();
    } catch (e: any) { setError(e.message); }
  };

  useEffect(() => { loadSchema(); }, []);

  useEffect(() => {
    if (selectedTable && activeTab === 'gui') {
      loadTableData(selectedTable);
    }
  }, [selectedTable, activeTab]);

  return (
    <div className="grid">
      <div className="card">
        <div className="header">
          <h2 className="card-title">Admin DB</h2>
        </div>

        {/* Token Input */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
          <label className="muted">Token</label>
          <input className="input" value={token} onChange={e => setToken(e.target.value)} style={{ width: 320 }} />
          <button className="btn" onClick={loadSchema}>Connect To DB</button>
        </div>

        {/* Tables Overview */}
        <div style={{ marginBottom: 12 }}>
          <div className="muted" style={{ marginBottom: 8 }}>Tables</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {tables?.map((t: any) => <span key={t.name} className="chip">{t.name}</span>)}
          </div>
        </div>

        {/* Tab Navigation */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid #202735' }}>
            <button
              className={`btn ${activeTab === 'gui' ? 'primary' : ''}`}
              onClick={() => setActiveTab('gui')}
              style={{ borderRadius: '4px 4px 0 0' }}
            >
              🎛️ GUI Interface
            </button>
            <button
              className={`btn ${activeTab === 'sql' ? 'primary' : ''}`}
              onClick={() => setActiveTab('sql')}
              style={{ borderRadius: '4px 4px 0 0' }}
            >
              💻 SQL Interface
            </button>
          </div>
        </div>

        {/* Error Display */}
        {error && <div style={{ color: '#ef4444', marginBottom: 12, padding: '8px', backgroundColor: '#2d1b1b', borderRadius: '4px', border: '1px solid #ef4444' }}>Error: {error}</div>}

        {/* GUI Interface */}
        {activeTab === 'gui' && (
          <div>
            {/* Table Selector */}
            <div style={{ marginBottom: 16 }}>
              <label className="muted" style={{ display: 'block', marginBottom: 8 }}>Select Table</label>
              <select
                className="input"
                value={selectedTable}
                onChange={e => setSelectedTable(e.target.value)}
                style={{ width: 200 }}
              >
                <option value="">Select a table...</option>
                {tables?.map(table => (
                  <option key={table.name} value={table.name}>{table.name}</option>
                ))}
              </select>
            </div>

            {selectedTable && (
              <>
                {/* Action Buttons */}
                <div style={{ marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button className="btn primary" onClick={handleCreateNew}>
                    ➕ Add New Record
                  </button>
                  <button className="btn" onClick={() => loadTableData(selectedTable)}>
                    🔄 Refresh
                  </button>
                  <span className="muted">
                    Table: <strong>{selectedTable}</strong> ({tableData.length} records)
                  </span>
                </div>

                {/* Create/Edit Form */}
                {(isCreating || editingRow) && (
                  <div className="card" style={{ marginBottom: 16, backgroundColor: '#1a2332', border: '1px solid #2d3b4e' }}>
                    <div className="card-title">
                      {isCreating ? `Add New Record to ${selectedTable}` : `Edit Record in ${selectedTable}`}
                    </div>

                    <div style={{ display: 'grid', gap: 12 }}>
                      {getFormColumns(selectedTable)
                        .filter(column => !(column.primary_key && isCreating) && !column.auto_generated) // Hide primary keys and auto-generated fields for new records
                        .map(column => (
                          <div key={column.name} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <label className="muted" style={{ fontSize: '0.9rem' }}>
                              {column.name}
                              {column.primary_key && <span style={{ color: '#f59e0b' }}> (Primary Key)</span>}
                              <span style={{ color: '#6b7280' }}> - {column.type}</span>
                              {!column.nullable && <span style={{ color: '#ef4444' }}> *</span>}
                            </label>
                            <input
                              className="input"
                              type={column.type.toLowerCase().includes('int') || column.type.toLowerCase().includes('real') ? 'number' :
                                column.type.toLowerCase().includes('date') ? 'datetime-local' : 'text'}
                              value={formData[column.name] || ''}
                              onChange={e => {
                                let value = e.target.value;
                                // Convert datetime-local to ISO string for DateTime fields
                                if (column.type.toLowerCase().includes('date') && value) {
                                  try {
                                    const date = new Date(value);
                                    // Check if the date is valid
                                    if (!isNaN(date.getTime())) {
                                      value = date.toISOString();
                                    }
                                    // If invalid, keep the original value (don't convert)
                                  } catch {
                                    // If conversion fails, keep the original value
                                  }
                                }
                                setFormData(prev => ({ ...prev, [column.name]: value }));
                              }}
                              placeholder={column.nullable ? 'Optional' : 'Required'}
                              disabled={column.primary_key && !isCreating}
                            />
                          </div>
                        ))}
                    </div>

                    <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
                      <button className="btn primary" onClick={handleSave}>
                        💾 Save
                      </button>
                      <button className="btn" onClick={() => { setIsCreating(false); setEditingRow(null); setFormData({}); }}>
                        ✖️ Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Data Table */}
                <div className="card">
                  <div className="card-title">Records in {selectedTable}</div>
                  {tableData.length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
                      <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>📭</div>
                      <div>No records found in this table</div>
                      <div style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>Click "Add New Record" to get started</div>
                    </div>
                  ) : (
                    <GuiTable
                      data={tableData}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      schema={getTableSchema(selectedTable)}
                    />
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* SQL Interface */}
        {activeTab === 'sql' && (
          <div>
            <div className="muted" style={{ marginBottom: 8 }}>SQL Query</div>
            <textarea
              value={sql}
              onChange={e => setSql(e.target.value)}
              rows={8}
              placeholder="e.g. CREATE TABLE demo(id TEXT); INSERT INTO demo(id) values('1'); SELECT * FROM demo;"
              style={{ width: '100%', marginBottom: 8 }}
            />
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <button className="btn" onClick={preview}>👁️ Preview</button>
              <button className="btn primary" onClick={execute}>⚡ Execute</button>
            </div>

            {rows && (
              <div className="card" style={{ marginBottom: 16 }}>
                <div className="card-title">Preview Results</div>
                <Table data={rows} />
              </div>
            )}

            {execResult != null && (
              <div style={{
                padding: '12px',
                backgroundColor: '#1a2332',
                border: '1px solid #22c55e',
                borderRadius: '4px',
                color: '#22c55e'
              }}>
                ✅ Execute result: {String(execResult)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function GuiTable({ data, onEdit, onDelete, schema }: {
  data: TableRow[],
  onEdit: (row: TableRow) => void,
  onDelete: (row: TableRow) => void,
  schema?: TableSchema
}) {
  if (!data.length) return <div className="muted">No rows</div>;

  const cols = Object.keys(data[0]);
  const primaryKey = schema?.columns?.find(col => col.primary_key);

  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="table">
        <thead>
          <tr>
            {cols.map(c => (
              <th key={c} className="muted">
                {c}
                {primaryKey?.name === c && <span style={{ color: '#f59e0b' }}> 🔑</span>}
              </th>
            ))}
            <th className="muted">Actions</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i}>
              {cols.map(c => (
                <td key={c} style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {String(row[c] || '').length > 50 ? String(row[c] || '').substring(0, 50) + '...' : String(row[c] || '')}
                </td>
              ))}
              <td>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    className="btn"
                    onClick={() => onEdit(row)}
                    style={{ fontSize: '0.8rem', padding: '4px 8px' }}
                    title="Edit this record"
                  >
                    ✏️
                  </button>
                  <button
                    className="btn"
                    onClick={() => onDelete(row)}
                    style={{ fontSize: '0.8rem', padding: '4px 8px', backgroundColor: '#7f1d1d', color: '#fca5a5' }}
                    title="Delete this record"
                  >
                    🗑️
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Table({ data }: { data: any[] }) {
  if (!data.length) return <div className="muted">No rows</div>;
  const cols = Object.keys(data[0]);
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="table">
        <thead>
          <tr>
            {cols.map(c => <th key={c} className="muted">{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i}>
              {cols.map(c => <td key={c}>{String(row[c])}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
