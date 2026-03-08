// Temporary mock data for employees when database is not available
export interface Employee {
  id: number;
  name: string;
  username: string;
  email: string;
  password: string;
  role: "staff";
  joinDate: string;
  status: "active" | "inactive";
  createdAt: string;
  updatedAt: string;
}

let mockEmployees: Employee[] = [
  {
    id: 1,
    name: 'John Doe',
    username: 'staff',
    email: 'john@wheezard.ph',
    password: 'staff123',
    role: 'staff',
    joinDate: new Date().toLocaleDateString('en-CA'),
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
];

export const mockEmployeeService = {
  getAll: () => Promise.resolve(mockEmployees),
  
  getById: (id: number) => Promise.resolve(mockEmployees.find(emp => emp.id === id)),
  
  create: (data: Omit<Employee, 'id' | 'joinDate' | 'createdAt' | 'updatedAt'>) => {
    const newEmployee: Employee = {
      ...data,
      id: Date.now(),
      joinDate: new Date().toLocaleDateString('en-CA'),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    mockEmployees.push(newEmployee);
    return Promise.resolve(newEmployee);
  },
  
  update: (id: number, data: Partial<Employee>) => {
    const index = mockEmployees.findIndex(emp => emp.id === id);
    if (index !== -1) {
      mockEmployees[index] = { 
        ...mockEmployees[index], 
        ...data, 
        updatedAt: new Date().toISOString() 
      };
      return Promise.resolve(mockEmployees[index]);
    }
    return Promise.resolve(null);
  },
  
  delete: (id: number) => {
    const index = mockEmployees.findIndex(emp => emp.id === id);
    if (index !== -1) {
      const deleted = mockEmployees[index];
      mockEmployees.splice(index, 1);
      return Promise.resolve(deleted);
    }
    return Promise.resolve(null);
  },
  
  findByUsername: (username: string) => Promise.resolve(mockEmployees.find(emp => emp.username === username))
};
