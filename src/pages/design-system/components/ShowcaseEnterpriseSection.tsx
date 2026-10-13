import React, { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/Table'
import { Skeleton } from '@/components/ui/Skeleton'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/Alert'
import { Progress } from '@/components/ui/Progress'
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/Breadcrumb'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
} from '@/components/ui/Pagination'
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/Badge'

export const ShowcaseEnterpriseSection: React.FC = () => {
  const [currentPage, setCurrentPage] = useState(1)

  return (
    <div className="space-y-6">
      {/* 1. Breadcrumbs & Avatars */}
      <Card>
        <CardHeader>
          <CardTitle>Navigation: Breadcrumb & Identity Primitives</CardTitle>
          <p className="text-xs text-[var(--text-secondary)]">
            Hierarchical routing crumbs and party avatars with auto-initial fallbacks.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink href="/invoices">Invoices</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>INV-2026-0042</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <Separator />

          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] block mb-3">
              Party & User Avatars
            </span>
            <div className="flex items-center gap-4">
              <Avatar size="xl">
                <AvatarFallback>HP</AvatarFallback>
              </Avatar>
              <Avatar size="lg">
                <AvatarFallback>AT</AvatarFallback>
              </Avatar>
              <Avatar size="md">
                <AvatarFallback>RK</AvatarFallback>
              </Avatar>
              <Avatar size="sm">
                <AvatarFallback>JD</AvatarFallback>
              </Avatar>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. Semantic Data Table */}
      <Card>
        <CardHeader>
          <CardTitle>Data Display: Semantic Table (`Table`, `Thead`, `Row`, `Cell`)</CardTitle>
          <p className="text-xs text-[var(--text-secondary)]">
            Clean ERP ledger presentation with hover highlights, semantic badges, and currency formatters.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Party Name</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount (₹)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-bold">INV-0081</TableCell>
                <TableCell>Reliance Retail Pvt Ltd</TableCell>
                <TableCell>12 Oct 2026</TableCell>
                <TableCell><Badge variant="paid" dot>Paid</Badge></TableCell>
                <TableCell className="text-right font-mono font-bold">₹1,45,200.00</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-bold">INV-0082</TableCell>
                <TableCell>Tata Teleservices</TableCell>
                <TableCell>13 Oct 2026</TableCell>
                <TableCell><Badge variant="pending" dot>Pending</Badge></TableCell>
                <TableCell className="text-right font-mono font-bold">₹38,400.00</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-bold">INV-0083</TableCell>
                <TableCell>Sharma Electricals</TableCell>
                <TableCell>13 Oct 2026</TableCell>
                <TableCell><Badge variant="overdue" dot>Overdue</Badge></TableCell>
                <TableCell className="text-right font-mono font-bold">₹12,750.00</TableCell>
              </TableRow>
            </TableBody>
          </Table>

          {/* Pagination Controls */}
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} />
              </PaginationItem>
              <PaginationItem>
                <PaginationLink isActive={currentPage === 1} onClick={() => setCurrentPage(1)}>1</PaginationLink>
              </PaginationItem>
              <PaginationItem>
                <PaginationLink isActive={currentPage === 2} onClick={() => setCurrentPage(2)}>2</PaginationLink>
              </PaginationItem>
              <PaginationItem>
                <PaginationLink isActive={currentPage === 3} onClick={() => setCurrentPage(3)}>3</PaginationLink>
              </PaginationItem>
              <PaginationItem>
                <PaginationEllipsis />
              </PaginationItem>
              <PaginationItem>
                <PaginationNext onClick={() => setCurrentPage(currentPage + 1)} />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </CardContent>
      </Card>

      {/* 3. Feedback: Alerts, Progress & Skeletons */}
      <Card>
        <CardHeader>
          <CardTitle>Feedback: Alerts, Progress & Skeletons</CardTitle>
          <p className="text-xs text-[var(--text-secondary)]">
            Semantic feedback banners, goal meters, and offline shimmer skeletons.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Alert variant="success">
              <AlertTitle>GST ITC Reconciled Successfully</AlertTitle>
              <AlertDescription>
                All 42 GSTR-2B purchase vouchers match your uploaded vendor invoices.
              </AlertDescription>
            </Alert>
            <Alert variant="warning">
              <AlertTitle>E-Way Bill Expiry Notice</AlertTitle>
              <AlertDescription>
                Vehicle MH-12-Q-4501 validity expires in 4 hours. Extend transit time.
              </AlertDescription>
            </Alert>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs font-bold text-[var(--text-primary)]">
              <span>Monthly Sales Target Progress</span>
              <span className="text-[var(--primary)] font-mono">74%</span>
            </div>
            <Progress value={74} />
          </div>

          <div className="space-y-2 pt-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] block">
              Offline-First Shimmer Skeletons (0ms UX)
            </span>
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-4 w-1/3 rounded-md" />
                <Skeleton className="h-3 w-1/2 rounded-md" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 4. Disclosure: Accordion */}
      <Card>
        <CardHeader>
          <CardTitle>Disclosure: Accordion Primitives</CardTitle>
          <p className="text-xs text-[var(--text-secondary)]">
            Expandable Radix disclosure panels for compliance and FAQs.
          </p>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible defaultValue="item-1">
            <AccordionItem value="item-1">
              <AccordionTrigger>How does HisaabPro handle offline data sync?</AccordionTrigger>
              <AccordionContent>
                HisaabPro operates with IndexedDB/Dexie as the primary local Source of Truth (SSOT). All invoices, payments, and ledger modifications are committed locally in 0ms and staged into an outbox reconciler that cascades updates upon reconnection.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-2">
              <AccordionTrigger>What GST formats are supported for automatic e-invoicing?</AccordionTrigger>
              <AccordionContent>
                All B2B invoices automatically generate standard NIC-compliant JSON payloads for IRN generation with QR code printing support.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </div>
  )
}
