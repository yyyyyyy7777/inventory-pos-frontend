"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, Trash2, Edit2, Search, Settings, Users } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useEmployees } from "@/contexts/employees-context"
import { useToast } from "@/contexts/toast-context"
import { useActivity } from "@/contexts/activity-context"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { EmptyState } from "@/components/ui/empty-state"
import { formatToLocalTime, debugTimezone } from "@/lib/datetime-utils"

interface Employee {
  id: number
  name: string
  username: string
  role: "admin" | "staff"
  joinDate: string
  lastLogin: string
  lastLogout: string
}

interface EmployeeManagementProps {
  username?: string
  cabinet?: string
}

export function EmployeeManagement({ username, cabinet }: EmployeeManagementProps) {
  const { employees, loading, addEmployee, updateEmployee, deleteEmployee, updateUserCredentials, refreshEmployees } = useEmployees()
  const { addToast } = useToast()
  const { addActivity } = useActivity()
  const [searchQuery, setSearchQuery] = useState("")
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [newEmployee, setNewEmployee] = useState({ name: "", username: "", password: "", confirmPassword: "" })
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({})
  const [touchedFields, setTouchedFields] = useState<{ [key: string]: boolean }>({})
  const [editingEmployee, setEditingEmployee] = useState<any | null>(null)
  const [showCredentialsDialog, setShowCredentialsDialog] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState<any | null>(null)
  const [newPassword, setNewPassword] = useState("")
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: number | null }>({ open: false, id: null })

  // Refresh employee data when component mounts
  useEffect(() => {
    refreshEmployees()
  }, [])

  const filteredEmployees = employees.filter(
    (emp) =>
      emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.username.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  // Password validation: min 8 chars, 1 uppercase, 1 lowercase, 1 number
  const validatePassword = (password: string): string | null => {
    if (password.length < 8) {
      return "Password must be at least 8 characters long"
    }
    if (!/[a-z]/.test(password)) {
      return "Password must contain at least one lowercase letter"
    }
    if (!/[A-Z]/.test(password)) {
      return "Password must contain at least one uppercase letter"
    }
    if (!/\d/.test(password)) {
      return "Password must contain at least one number"
    }
    return null
  }

  const handleAddEmployee = async () => {
    // Validate all required fields
    const errors: { [key: string]: string } = {}
    
    if (!newEmployee.name.trim()) {
      errors.name = "Full name is required"
    }
    if (!newEmployee.username.trim()) {
      errors.username = "Username is required"
    }
    if (!newEmployee.password) {
      errors.password = "Password is required"
    }
    if (!newEmployee.confirmPassword) {
      errors.confirmPassword = "Please confirm the password"
    }

    // Mark all fields as touched
    setTouchedFields({
      name: true,
      username: true,
      password: true,
      confirmPassword: true
    })

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      addToast("Please fill in all required fields", "error")
      return
    }

    // Validate password
    const passwordError = validatePassword(newEmployee.password)
    if (passwordError) {
      setFormErrors({ password: passwordError })
      addToast(passwordError, "error")
      return
    }

    // Check if passwords match
    if (newEmployee.password !== newEmployee.confirmPassword) {
      setFormErrors({ confirmPassword: "Passwords do not match" })
      addToast("Passwords do not match", "error")
      return
    }

    if (newEmployee.name && newEmployee.username && newEmployee.password) {
      try {
        await addEmployee({
          name: newEmployee.name,
          username: newEmployee.username,
          password: newEmployee.password,
          role: "staff",
        })
        addToast(`Employee "${newEmployee.name}" added successfully!`, "success")
        
        // Log activity
        addActivity({
          username: username || "Unknown User",
          activity: "Added New Employee",
          details: `Added employee "${newEmployee.name}" (@${newEmployee.username}) as staff`,
          category: "employee",
          cabinet: cabinet || "main"
        })
        
        setNewEmployee({ name: "", username: "", password: "", confirmPassword: "" })
        setFormErrors({})
        setTouchedFields({})
        setShowAddForm(false)
      } catch (error: any) {
        // Show specific error messages
        if (error.message.includes('Staff with this name already exists')) {
          addToast("Staff with this name already exists", "error")
        } else if (error.message.includes('Username already exists')) {
          addToast("Username already exists", "error")
        } else {
          addToast("Failed to add employee", "error")
        }
      }
    }
  }

  const handleDeleteEmployee = (id: number) => {
    // Prevent deletion of admin user
    const employee = employees.find(emp => emp.id === id);
    if (employee?.role === 'admin') {
      addToast("Cannot delete admin user", "error");
      return;
    }
    setDeleteConfirm({ open: true, id });
  }

  const confirmDelete = async () => {
    if (deleteConfirm.id) {
      try {
        const employee = employees.find(emp => emp.id === deleteConfirm.id)
        await deleteEmployee(deleteConfirm.id)
        addToast("Employee deleted successfully!", "success")
        
        // Log activity
        if (employee) {
          addActivity({
            username: username || "Unknown User",
            activity: "Deleted Employee",
            details: `Deleted employee "${employee.name}" (@${employee.username}) - ${employee.role}`,
            category: "employee",
            cabinet: cabinet || "main"
          })
        }
        
        setDeleteConfirm({ open: false, id: null })
      } catch (error) {
        addToast("Failed to delete employee", "error")
      }
    }
  }

  const handleEditEmployee = (employee: any) => {
    // Prevent editing of admin user details (only password can be changed)
    if (employee.role === 'admin') {
      setSelectedEmployee(employee);
      setShowCredentialsDialog(true);
      return;
    }
    setEditingEmployee(employee)
    setEditingId(employee.id)
  }

  const handleSaveEdit = async () => {
    if (editingEmployee) {
      try {
        await updateEmployee(editingEmployee.id, {
          name: editingEmployee.name,
          username: editingEmployee.username,
        })
        addToast("Employee updated successfully!", "success")
        
        // Log activity
        addActivity({
          username: username || "Unknown User",
          activity: "Updated Employee",
          details: `Updated details for "${editingEmployee.name}" (@${editingEmployee.username})`,
          category: "employee",
          cabinet: cabinet || "main"
        })
        
        setEditingId(null)
        setEditingEmployee(null)
      } catch (error) {
        addToast("Failed to update employee", "error")
      }
    }
  }

  const handleUpdateCredentials = async () => {
    if (selectedEmployee && newPassword) {
      try {
        if (selectedEmployee.role === 'admin') {
          // Update admin password
          const response = await fetch('/api/employees', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ id: selectedEmployee.id, password: newPassword }),
          });
          
          if (response.ok) {
            addToast("Admin password updated successfully!", "success");
            
            // Log activity
            addActivity({
              username: username || "Unknown User",
              activity: "Updated Password",
              details: `Changed password for admin user (${selectedEmployee.username})`,
              category: "employee",
              cabinet: cabinet || "main"
            });
          } else {
            throw new Error('Failed to update admin password');
          }
        } else {
          // Update employee password
          await updateUserCredentials(selectedEmployee.username, newPassword);
          addToast("Credentials updated successfully!", "success");
          
          // Log activity
          addActivity({
            username: username || "Unknown User",
            activity: "Updated Password",
            details: `Changed password for "${selectedEmployee.name}" (@${selectedEmployee.username})`,
            category: "employee",
            cabinet: cabinet || "main"
          });
        }
        resetCredentialsDialog();
      } catch (error) {
        addToast("Failed to update credentials", "error");
      }
    }
  }

  const resetCredentialsDialog = () => {
    setShowCredentialsDialog(false)
    setSelectedEmployee(null)
    setNewPassword("")
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Search by name or username..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button
          onClick={() => setShowAddForm(true)}
          className="bg-primary hover:bg-primary/90 text-primary-foreground flex items-center gap-2"
        >
          <Plus size={18} />
          Add Employee
        </Button>
      </div>

      <Dialog open={showAddForm} onOpenChange={setShowAddForm}>
        <DialogContent className="max-w-md mx-4">
          <DialogHeader>
            <DialogTitle>Add New Employee</DialogTitle>
            <DialogDescription>Enter employee details to add to the system</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Full Name <span className="text-destructive">*</span>
              </label>
              <Input
                placeholder="Employee name"
                value={newEmployee.name}
                onChange={(e) => {
                  setNewEmployee({ ...newEmployee, name: e.target.value })
                  if (touchedFields.name) {
                    setFormErrors({ ...formErrors, name: e.target.value.trim() ? "" : "Full name is required" })
                  }
                }}
                onBlur={() => {
                  setTouchedFields({ ...touchedFields, name: true })
                  if (!newEmployee.name.trim()) {
                    setFormErrors({ ...formErrors, name: "Full name is required" })
                  }
                }}
                className={formErrors.name && touchedFields.name ? "border-destructive focus:border-destructive" : ""}
              />
              {formErrors.name && touchedFields.name && (
                <p className="text-xs text-destructive mt-1">{formErrors.name}</p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Username <span className="text-destructive">*</span>
              </label>
              <Input
                placeholder="Username for login"
                value={newEmployee.username}
                onChange={(e) => {
                  setNewEmployee({ ...newEmployee, username: e.target.value })
                  if (touchedFields.username) {
                    setFormErrors({ ...formErrors, username: e.target.value.trim() ? "" : "Username is required" })
                  }
                }}
                onBlur={() => {
                  setTouchedFields({ ...touchedFields, username: true })
                  if (!newEmployee.username.trim()) {
                    setFormErrors({ ...formErrors, username: "Username is required" })
                  }
                }}
                className={formErrors.username && touchedFields.username ? "border-destructive focus:border-destructive" : ""}
              />
              {formErrors.username && touchedFields.username && (
                <p className="text-xs text-destructive mt-1">{formErrors.username}</p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Password <span className="text-destructive">*</span>
              </label>
              <Input
                type="password"
                placeholder="Initial password"
                value={newEmployee.password}
                onChange={(e) => {
                  setNewEmployee({ ...newEmployee, password: e.target.value })
                  if (touchedFields.password) {
                    const error = e.target.value ? validatePassword(e.target.value) : "Password is required"
                    setFormErrors({ ...formErrors, password: error || "" })
                  }
                }}
                onBlur={() => {
                  setTouchedFields({ ...touchedFields, password: true })
                  if (!newEmployee.password) {
                    setFormErrors({ ...formErrors, password: "Password is required" })
                  }
                }}
                className={formErrors.password && touchedFields.password ? "border-destructive focus:border-destructive" : ""}
              />
              {formErrors.password && touchedFields.password ? (
                <p className="text-xs text-destructive mt-1">{formErrors.password}</p>
              ) : (
                <p className="text-xs text-muted-foreground mt-1">
                  Min 8 chars: 1 uppercase, 1 lowercase, 1 number (e.g., Staff2024)
                </p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Confirm Password <span className="text-destructive">*</span>
              </label>
              <Input
                type="password"
                placeholder="Re-enter password"
                value={newEmployee.confirmPassword}
                onChange={(e) => {
                  setNewEmployee({ ...newEmployee, confirmPassword: e.target.value })
                  if (touchedFields.confirmPassword) {
                    const error = !e.target.value ? "Please confirm the password" : 
                      e.target.value !== newEmployee.password ? "Passwords do not match" : ""
                    setFormErrors({ ...formErrors, confirmPassword: error })
                  }
                }}
                onBlur={() => {
                  setTouchedFields({ ...touchedFields, confirmPassword: true })
                  if (!newEmployee.confirmPassword) {
                    setFormErrors({ ...formErrors, confirmPassword: "Please confirm the password" })
                  } else if (newEmployee.confirmPassword !== newEmployee.password) {
                    setFormErrors({ ...formErrors, confirmPassword: "Passwords do not match" })
                  }
                }}
                className={formErrors.confirmPassword && touchedFields.confirmPassword ? "border-destructive focus:border-destructive" : ""}
              />
              {formErrors.confirmPassword && touchedFields.confirmPassword && (
                <p className="text-xs text-destructive mt-1">{formErrors.confirmPassword}</p>
              )}
            </div>
            <div className="flex gap-2">
              <Button onClick={handleAddEmployee} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                Create Employee
              </Button>
              <Button onClick={() => setShowAddForm(false)} variant="outline">
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editingId !== null} onOpenChange={() => setEditingId(null)}>
        <DialogContent className="max-w-md mx-4">
          <DialogHeader>
            <DialogTitle>Edit Employee</DialogTitle>
            <DialogDescription>Update employee details</DialogDescription>
          </DialogHeader>
          {editingEmployee && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Full Name</label>
                <Input
                  value={editingEmployee.name}
                  onChange={(e) => setEditingEmployee({ ...editingEmployee, name: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Username</label>
                <Input
                  value={editingEmployee.username}
                  onChange={(e) => setEditingEmployee({ ...editingEmployee, username: e.target.value })}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSaveEdit} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                  Save Changes
                </Button>
                <Button onClick={() => setEditingId(null)} variant="outline">
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Card className="bg-card border-primary/10 overflow-hidden">
        <CardHeader>
          <CardTitle>Employee Directory</CardTitle>
          <CardDescription>Manage staff members and their access</CardDescription>
        </CardHeader>
        <CardContent>
          {filteredEmployees.length === 0 ? (
            <EmptyState
              icon={<Users size={48} className="text-gray-400" />}
              title="No employees found"
              description={searchQuery ? "Try adjusting your search criteria" : "Start by adding your first employee"}
              action={{ label: "Add Employee", onClick: () => setShowAddForm(true) }}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead className="border-b border-border bg-muted/50">
                  <tr>
                    <th className="text-left py-3 px-4 font-semibold text-foreground">Role</th>
                    <th className="text-left py-3 px-4 font-semibold text-foreground">Name</th>
                    <th className="text-left py-3 px-4 font-semibold text-foreground">Username</th>
                    <th className="text-left py-3 px-4 font-semibold text-foreground">Join Date</th>
                    <th className="text-left py-3 px-4 font-semibold text-foreground">Login</th>
                    <th className="text-left py-3 px-4 font-semibold text-foreground">Logout</th>
                    <th className="text-left py-3 px-4 font-semibold text-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredEmployees.map((employee) => (
                  <tr key={employee.id} className={`hover:bg-muted/50 transition-colors ${employee.role === 'admin' ? 'bg-primary/5' : ''}`}>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        employee.role === "admin" 
                          ? "bg-primary/20 text-primary border border-primary/30" 
                          : "bg-muted text-muted-foreground border border-border"
                      }`}>
                        {employee.role === "admin" ? "Admin" : "Staff"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-foreground font-medium">{employee.name}</td>
                    <td className="py-3 px-4 text-muted-foreground text-sm">@{employee.username}</td>
                    <td className="py-3 px-4 text-muted-foreground text-sm">
                      {new Date(employee.joinDate).toLocaleDateString('en-US', { 
                        month: 'long', 
                        day: 'numeric', 
                        year: 'numeric' 
                      })}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground text-sm">
                      {formatToLocalTime(employee.lastLogin, { includeSeconds: false })}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground text-sm">
                      {formatToLocalTime(employee.lastLogout, { includeSeconds: false })}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-primary hover:bg-primary/10 h-10 w-10 p-0 sm:h-8 sm:w-8"
                          onClick={() => handleEditEmployee(employee)}
                          disabled={employee.role === 'admin'}
                          title={employee.role === 'admin' ? "Use settings button to change admin password" : "Edit employee"}
                        >
                          <Edit2 size={14} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground hover:bg-muted/20 h-10 w-10 p-0 sm:h-8 sm:w-8"
                          onClick={() => {
                            setSelectedEmployee(employee)
                            setShowCredentialsDialog(true)
                          }}
                          title="Change password"
                        >
                          <Settings size={14} />
                        </Button>
                        {employee.role !== 'admin' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:bg-destructive/10 h-10 w-10 p-0 sm:h-8 sm:w-8"
                            onClick={() => handleDeleteEmployee(employee.id)}
                            title="Delete employee"
                          >
                            <Trash2 size={14} />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={deleteConfirm.open}
        title="Delete Employee"
        description="Are you sure you want to delete this employee? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        isDangerous={true}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirm({ open: false, id: null })}
      />

      <Dialog open={showCredentialsDialog} onOpenChange={resetCredentialsDialog}>
        <DialogContent className="max-w-md mx-4">
          <DialogHeader>
            <DialogTitle>Update Credentials</DialogTitle>
            <DialogDescription>
              Change login credentials for {selectedEmployee?.name}
              {selectedEmployee?.id === 0 && " (Administrator)"}
            </DialogDescription>
          </DialogHeader>
          {selectedEmployee && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Username</label>
                <Input
                  value={selectedEmployee.username}
                  disabled
                  className="bg-muted"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">New Password</label>
                <Input
                  type="password"
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button 
                  onClick={handleUpdateCredentials} 
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
                  disabled={!newPassword}
                >
                  Update Password
                </Button>
                <Button onClick={resetCredentialsDialog} variant="outline">
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
