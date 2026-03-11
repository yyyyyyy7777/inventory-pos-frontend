'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/contexts/toast-context'

export default function SalesRecoveryPage() {
  const { addToast } = useToast()
  const [loading, setLoading] = useState(true)
  const [allSales, setAllSales] = useState<any[]>([])
  const [stats, setStats] = useState<any>(null)
  const [cabinet, setCabinet] = useState('main')

  const fetchAllSales = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/sales/all?cabinet=${cabinet}`)
      if (!response.ok) throw new Error('Failed to fetch sales')
      const data = await response.json()
      setAllSales(data.sales || [])
      setStats(data.stats)
    } catch (error) {
      addToast('Failed to load sales data', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAllSales()
  }, [cabinet])

  const unarchiveSale = async (saleId: string) => {
    try {
      const response = await fetch('/api/sales/unarchive-single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ saleId })
      })
      
      if (!response.ok) throw new Error('Failed to unarchive')
      
      addToast('Sale restored successfully!', 'success')
      fetchAllSales()
    } catch (error) {
      addToast('Failed to restore sale', 'error')
    }
  }

  const unarchiveAllForMonth = async (yearMonth: string) => {
    if (!confirm(`Restore all archived sales for ${yearMonth}?`)) return
    
    try {
      const response = await fetch('/api/sales/unarchive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unarchiveMonth: yearMonth, cabinet })
      })
      
      const result = await response.json()
      if (result.unarchivedCount > 0) {
        addToast(`${result.unarchivedCount} sales restored!`, 'success')
      } else {
        addToast('No archived sales found for that month', 'warning')
      }
      fetchAllSales()
    } catch (error) {
      addToast('Failed to restore sales', 'error')
    }
  }

  // Group sales by month
  const salesByMonth: Record<string, any[]> = {}
  allSales.forEach(sale => {
    const date = new Date(sale.date)
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    if (!salesByMonth[key]) salesByMonth[key] = []
    salesByMonth[key].push(sale)
  })

  const sortedMonths = Object.keys(salesByMonth).sort().reverse()

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Sales Recovery / Archive Manager</h1>
      
      <div className="mb-4 flex gap-2">
        <select 
          value={cabinet} 
          onChange={(e) => setCabinet(e.target.value)}
          className="border rounded px-3 py-2"
        >
          <option value="main">Main Cabinet</option>
          <option value="secondary">Secondary Cabinet</option>
        </select>
        <Button onClick={fetchAllSales} disabled={loading}>
          {loading ? 'Loading...' : 'Refresh'}
        </Button>
      </div>

      {stats && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded">
                <div className="text-2xl font-bold">{stats.total}</div>
                <div className="text-sm text-gray-600">Total Sales</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded">
                <div className="text-2xl font-bold">{stats.active}</div>
                <div className="text-sm text-gray-600">Active</div>
              </div>
              <div className="text-center p-4 bg-orange-50 rounded">
                <div className="text-2xl font-bold">{stats.archived}</div>
                <div className="text-sm text-gray-600">Archived</div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded">
                <div className="text-2xl font-bold">{stats.earliestDate?.substring(0, 10)}</div>
                <div className="text-sm text-gray-600">Earliest Sale</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {sortedMonths.map(month => {
          const monthSales = salesByMonth[month]
          const archivedCount = monthSales.filter(s => s.archived).length
          const activeCount = monthSales.filter(s => !s.archived).length
          
          return (
            <Card key={month}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-center">
                  <CardTitle>{month}</CardTitle>
                  {archivedCount > 0 && (
                    <Button 
                      onClick={() => unarchiveAllForMonth(month)}
                      variant="outline"
                      className="text-orange-600 border-orange-300"
                    >
                      Restore {archivedCount} Archived
                    </Button>
                  )}
                </div>
                <div className="text-sm text-gray-500">
                  {activeCount} active, {archivedCount} archived, {monthSales.length} total
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left">Date</th>
                        <th className="px-3 py-2 text-left">Amount</th>
                        <th className="px-3 py-2 text-left">Staff</th>
                        <th className="px-3 py-2 text-left">Status</th>
                        <th className="px-3 py-2 text-left">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthSales.slice(0, 5).map(sale => (
                        <tr key={sale.id} className={sale.archived ? 'bg-orange-50' : ''}>
                          <td className="px-3 py-2">
                            {new Date(sale.date).toLocaleDateString()}
                          </td>
                          <td className="px-3 py-2">₱{sale.amount}</td>
                          <td className="px-3 py-2">{sale.staffName}</td>
                          <td className="px-3 py-2">
                            {sale.archived ? (
                              <span className="text-orange-600 font-medium">Archived</span>
                            ) : (
                              <span className="text-green-600">Active</span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {sale.archived && (
                              <Button 
                                size="sm" 
                                onClick={() => unarchiveSale(sale.id)}
                                className="text-xs"
                              >
                                Restore
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                      {monthSales.length > 5 && (
                        <tr>
                          <td colSpan={5} className="px-3 py-2 text-center text-gray-500">
                            ... and {monthSales.length - 5} more sales
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {allSales.length === 0 && !loading && (
        <div className="text-center py-10 text-gray-500">
          No sales found in database
        </div>
      )}
    </div>
  )
}
