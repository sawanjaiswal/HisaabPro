/** Table — Canonical shadcn / Radix Table Primitive (SSOT)
 *
 * Full semantic table element suite with tokenized padding, borders,
 * sticky headers, and responsive horizontal scroll container.
 */

import * as React from 'react'
import { cn } from '@/lib/utils'

export interface TableProps extends React.HTMLAttributes<HTMLTableElement> {
  containerClassName?: string
  maxHeight?: string | number
}

export const Table = React.forwardRef<HTMLTableElement, TableProps>(
  ({ className, containerClassName, maxHeight, style, ...props }, ref) => (
    <div
      style={maxHeight !== undefined ? { maxHeight } : undefined}
      className={cn(
        'relative w-full overflow-auto rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)]',
        containerClassName
      )}
    >
      <table
        ref={ref}
        className={cn('w-full caption-bottom text-sm text-[var(--text-primary)]', className)}
        style={style}
        {...props}
      />
    </div>
  )
)
Table.displayName = 'Table'

export const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead
    ref={ref}
    className={cn(
      'sticky top-0 z-10 border-b border-[var(--border-default)] bg-[var(--bg-surface-subtle)] backdrop-blur-sm',
      className
    )}
    {...props}
  />
))
TableHeader.displayName = 'TableHeader'

export const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn('[&_tr:last-child]:border-0', className)}
    {...props}
  />
))
TableBody.displayName = 'TableBody'

export const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn('border-t border-[var(--border-default)] bg-[var(--bg-surface-subtle)] font-medium text-[var(--text-primary)]', className)}
    {...props}
  />
))
TableFooter.displayName = 'TableFooter'

export const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      'border-b border-[var(--border-subtle)] transition-colors hover:bg-[var(--bg-surface-hover)] data-[state=selected]:bg-[var(--primary-subtle)]',
      className
    )}
    {...props}
  />
))
TableRow.displayName = 'TableRow'

export const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, scope = 'col', ...props }, ref) => (
  <th
    ref={ref}
    scope={scope}
    className={cn(
      'h-11 px-4 text-left align-middle text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] [&:has([role=checkbox])]:pr-0',
      className
    )}
    {...props}
  />
))
TableHead.displayName = 'TableHead'

export const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn('p-4 align-middle text-sm font-medium text-[var(--text-primary)] [&:has([role=checkbox])]:pr-0', className)}
    {...props}
  />
))
TableCell.displayName = 'TableCell'

export const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn('mt-4 text-xs text-[var(--text-muted)]', className)}
    {...props}
  />
))
TableCaption.displayName = 'TableCaption'
