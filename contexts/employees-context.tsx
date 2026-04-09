"use client"

import { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import { db } from '@/lib/indexeddb';
import { enhancedSyncService } from '@/lib/enhanced-sync';

export interface Employee {
  id: number;
  name: string;
  username: string;
  password: string;
  email?: string;
  phone?: string;
  role: 'admin' | 'manager' | 'staff';
  cabinet: string;
  joinDate: string;
  createdAt?: string;
  updatedAt?: string;
  synced?: boolean;
  lastModified?: number;
}

export interface UserCredentials {
  username: string;
  password: string;
  role: 'admin' | 'manager' | 'staff';
}

interface EmployeesContextType {
  employees: Employee[];
  loading: boolean;
  addEmployee: (employee: Omit<Employee, 'id' | 'joinDate' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateEmployee: (id: number, updates: Partial<Employee>) => Promise<void>;
  deleteEmployee: (id: number) => Promise<void>;
  getUserCredentials: (username: string) => Promise<UserCredentials | null>;
  updateUserCredentials: (username: string, password: string) => Promise<void>;
  refreshEmployees: () => Promise<void>;
}

const EmployeesContext = createContext<EmployeesContextType | undefined>(undefined);

export function EmployeesProvider({ children }: { children: ReactNode }) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(true);

  // Load employees from IndexedDB on mount
  useEffect(() => {
    const loadFromIndexedDB = async () => {
      try {
        setIsOnline(navigator.onLine);
        
        const allEmployees = await db.employees.toArray();
        // Convert from IndexedDB format and add missing fields
        const parsedEmployees = allEmployees.map(e => ({ 
          ...e, 
          id: Number(e.id),
          username: (e as any).username || '',
          password: (e as any).password || ''
        }));
        setEmployees(parsedEmployees);
        setLoading(false);
        console.log('Loaded employees from IndexedDB:', allEmployees.length);
      } catch (err) {
        console.error('Error loading from IndexedDB:', err);
        // Fallback to localStorage for migration
        const cachedEmployees = localStorage.getItem('cached_employees');
        if (cachedEmployees) {
          try {
            const parsed = JSON.parse(cachedEmployees);
            setEmployees(parsed);
            setLoading(false);
            // Migrate to IndexedDB
            await db.employees.bulkPut(parsed.map((e: Employee) => ({ ...e, id: String(e.id), synced: true })));
          } catch (migrationErr) {
            console.error('Migration error:', migrationErr);
          }
        }
      }

      // Listen for online/offline events
      const handleOnline = () => {
        setIsOnline(true);
        enhancedSyncService.syncAll();
      };
      const handleOffline = () => setIsOnline(false);
      
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      
      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    };
    
    loadFromIndexedDB();
  }, []);

  // Cache employees to IndexedDB
  const cacheEmployees = async (employeesData: Employee[]) => {
    try {
      await db.employees.clear();
      // Convert to IndexedDB format (string IDs)
      const dbEmployees = employeesData.map(e => ({ 
        ...e, 
        id: String(e.id),
        synced: true,
        lastModified: Date.now()
      }));
      await db.employees.bulkPut(dbEmployees);
      console.log('Cached employees to IndexedDB:', employeesData.length);
    } catch (err) {
      console.error('Error caching to IndexedDB:', err);
      // Fallback to localStorage
      localStorage.setItem('cached_employees', JSON.stringify(employeesData));
    }
  };

  // Fetch employees from API on initial render
  const fetchEmployees = async () => {
    try {
      // If offline, don't try to fetch - use cached data
      if (!isOnline) {
        console.log('Offline mode - using cached employees');
        return;
      }

      setLoading(true);
      const response = await fetch('/api/employees');
      if (response.ok) {
        const data = await response.json();
        setEmployees(data);
        cacheEmployees(data);
      } else {
        throw new Error('Failed to fetch employees');
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
      
      // If fetch fails and we have IndexedDB data, use that
      try {
        const allEmployees = await db.employees.toArray();
        if (allEmployees.length > 0) {
          // Convert from IndexedDB format
          const parsedEmployees = allEmployees.map(e => ({ 
            ...e, 
            id: Number(e.id),
            username: (e as any).username || '',
            password: (e as any).password || ''
          }));
          setEmployees(parsedEmployees);
          console.log('Fallback to IndexedDB:', allEmployees.length);
        }
      } catch (cacheErr) {
        console.error('Error loading from IndexedDB as fallback:', cacheErr);
      }
      // Don't throw error to prevent breaking the UI, just log it
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, [isOnline]);

  const addEmployee = async (employee: Omit<Employee, 'id' | 'joinDate' | 'createdAt' | 'updatedAt'>) => {
    try {
      const now = new Date().toISOString();
      const employeeId = Date.now(); // Generate numeric ID
      
      const newEmployee: Employee = {
        ...employee,
        id: employeeId,
        joinDate: now,
        createdAt: now,
        updatedAt: now,
        synced: false,
        lastModified: Date.now(),
      };
      
      // Save to IndexedDB first
      await db.employees.add({ ...newEmployee, id: String(employeeId) });
      
      // Update local state
      setEmployees(prev => [...prev, newEmployee]);
      
      if (isOnline) {
        // Try to sync to server
        try {
          const response = await fetch('/api/employees', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(employee),
          });

          if (response.ok) {
            const savedEmployee = await response.json();
            // Update with server data
            await db.employees.update(String(employeeId), { ...savedEmployee, synced: true });
            setEmployees(prev => prev.map(e => e.id === employeeId ? { ...savedEmployee, synced: true } : e));
          } else {
            // Queue for later sync
            await enhancedSyncService.queueChange('employee', 'create', newEmployee, employee.cabinet);
          }
        } catch (error) {
          console.log('❌ Server request failed, queued for sync:', error);
          await enhancedSyncService.queueChange('employee', 'create', newEmployee, employee.cabinet);
        }
      } else {
        // Offline: queue for sync
        await enhancedSyncService.queueChange('employee', 'create', newEmployee, employee.cabinet);
        console.log('📱 Employee saved offline for later sync:', employeeId);
      }
    } catch (error) {
      console.error('Error adding employee:', error);
      throw error;
    }
  };

  const updateEmployee = async (id: number, updates: Partial<Employee>) => {
    try {
      const now = new Date().toISOString();
      
      // Update in IndexedDB first
      const { id: _, ...updatesWithoutId } = updates as any;
      const dbUpdates = { 
        ...updatesWithoutId, 
        updatedAt: now,
        synced: false, 
        lastModified: Date.now() 
      };
      await db.employees.update(String(id), dbUpdates);
      
      // Update local state
      setEmployees(prev => 
        prev.map(emp => emp.id === id ? { ...emp, ...updates, synced: false } : emp)
      );
      
      if (isOnline) {
        // Try to sync to server
        try {
          const response = await fetch('/api/employees', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ id, ...updates }),
          });

          if (response.ok) {
            const updatedEmployee = await response.json();
            // Mark as synced
            await db.employees.update(String(id), { ...updatedEmployee, synced: true });
            setEmployees(prev => 
              prev.map(emp => emp.id === id ? { ...updatedEmployee, synced: true } : emp)
            );
          } else {
            // Get employee for cabinet info
            const emp = await db.employees.get(String(id));
            if (emp) {
              await enhancedSyncService.queueChange('employee', 'update', { id, updates, cabinet: emp.cabinet }, emp.cabinet);
            }
          }
        } catch (error) {
          console.log('❌ Server update failed, queued for sync:', error);
          const emp = await db.employees.get(String(id));
          if (emp) {
            await enhancedSyncService.queueChange('employee', 'update', { id, updates, cabinet: emp.cabinet }, emp.cabinet);
          }
        }
      } else {
        // Offline: queue for sync
        const emp = await db.employees.get(String(id));
        if (emp) {
          await enhancedSyncService.queueChange('employee', 'update', { id, updates, cabinet: emp.cabinet }, emp.cabinet);
        }
        console.log('📱 Employee update queued for sync:', id);
      }
    } catch (error) {
      console.error('Error updating employee:', error);
      throw error;
    }
  };

  const deleteEmployee = async (id: number) => {
    try {
      // Get employee for cabinet info before deleting
      const emp = await db.employees.get(String(id));
      const cabinet = emp?.cabinet || 'main';
      
      // Delete from IndexedDB
      await db.employees.delete(String(id));
      
      // Update local state
      setEmployees(prev => prev.filter(emp => emp.id !== id));
      
      if (isOnline) {
        // Try to sync to server
        try {
          const response = await fetch(`/api/employees?id=${id}`, {
            method: 'DELETE',
          });

          if (!response.ok) {
            console.log('❌ Server delete failed, queued for sync');
            await enhancedSyncService.queueChange('employee', 'delete', { id }, cabinet);
          }
        } catch (error) {
          console.log('❌ Server delete failed, queued for sync:', error);
          await enhancedSyncService.queueChange('employee', 'delete', { id }, cabinet);
        }
      } else {
        // Offline: queue for sync
        await enhancedSyncService.queueChange('employee', 'delete', { id }, cabinet);
        console.log('📱 Employee delete queued for sync:', id);
      }
    } catch (error) {
      console.error('Error deleting employee:', error);
      throw error;
    }
  };

  const getUserCredentials = async (username: string): Promise<UserCredentials | null> => {
    // For employees, we need to check against the database
    const employee = employees.find(emp => emp.username === username);
    if (employee) {
      return {
        username: employee.username,
        password: employee.password, // This is now hashed
        role: employee.role
      };
    }
    
    return null;
  };

  const updateUserCredentials = async (username: string, password: string) => {
    try {
      const employee = employees.find(emp => emp.username === username);
      if (employee) {
        await updateEmployee(employee.id, { password });
      }
    } catch (error) {
      console.error('Error updating user credentials:', error);
      throw error;
    }
  };

  const refreshEmployees = async () => {
    await fetchEmployees();
  };

  return (
    <EmployeesContext.Provider value={{ 
      employees, 
      loading,
      addEmployee, 
      updateEmployee, 
      deleteEmployee,
      getUserCredentials,
      updateUserCredentials,
      refreshEmployees
    }}>
      {children}
    </EmployeesContext.Provider>
  );
}

export function useEmployees() {
  const context = useContext(EmployeesContext);
  if (context === undefined) {
    throw new Error('useEmployees must be used within an EmployeesProvider');
  }
  return context;
}
