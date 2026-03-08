"use client"

import { createContext, useContext, ReactNode, useState, useEffect } from 'react';

export interface Employee {
  id: number;
  name: string;
  username: string;
  password: string;
  role: "admin" | "staff";
  joinDate: string;
  lastLogin?: string;
  lastLogout?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserCredentials {
  username: string;
  password: string;
  role: "admin" | "staff";
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

  // Fetch employees from API on initial render
  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/employees');
      if (response.ok) {
        const data = await response.json();
        setEmployees(data);
      } else {
        throw new Error('Failed to fetch employees');
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
      // Don't throw error to prevent breaking the UI, just log it
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const addEmployee = async (employee: Omit<Employee, 'id' | 'joinDate' | 'createdAt' | 'updatedAt'>) => {
    try {
      const response = await fetch('/api/employees', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(employee),
      });

      if (response.ok) {
        await fetchEmployees(); // Refresh the list
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add employee');
      }
    } catch (error) {
      console.error('Error adding employee:', error);
      throw error;
    }
  };

  const updateEmployee = async (id: number, updates: Partial<Employee>) => {
    try {
      const response = await fetch('/api/employees', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id, ...updates }),
      });

      if (response.ok) {
        await fetchEmployees(); // Refresh the list
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update employee');
      }
    } catch (error) {
      console.error('Error updating employee:', error);
      throw error;
    }
  };

  const deleteEmployee = async (id: number) => {
    try {
      const response = await fetch(`/api/employees?id=${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await fetchEmployees(); // Refresh the list
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete employee');
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
