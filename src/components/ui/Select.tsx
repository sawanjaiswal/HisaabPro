/** Select — Re-skinned with HisaabPro design tokens and searchable / create-option capabilities.
 *
 * Supports both:
 * 1. Declarative children:
 *    <Select value={v} onValueChange={setV}>
 *      <SelectItem value="a">A</SelectItem>
 *    </Select>
 * 2. Searchable with instant "+ Add as option" callback (VaahanPro inspired):
 *    <Select
 *      options={options}
 *      searchable
 *      onCreateOption={(name) => handleCreate(name)}
 *      createOptionLabel={(name) => `+ Add "${name}" as new category`}
 *    />
 */
import React, { useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback } from 'react'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Select as RX } from 'radix-ui'
import { Check, ChevronDown, Search, X, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import './overlay.css'

export interface SelectOption {
  value: string
  label: string
  icon?: ReactNode
  description?: string
  disabled?: boolean
}

export interface SelectProps {
  id?: string
  name?: string
  label?: string
  error?: string
  value?: string
  defaultValue?: string
  onChange?: (event: React.ChangeEvent<HTMLSelectElement> | { target: { value: string; name?: string } }) => void
  onValueChange?: (value: string) => void
  options?: SelectOption[]
  children?: ReactNode
  placeholder?: string
  disabled?: boolean
  className?: string
  triggerClassName?: string
  dropdownClassName?: string
  size?: 'sm' | 'default' | 'compact'
  searchable?: boolean
  align?: 'start' | 'end'
  required?: boolean
  ariaLabel?: string
  onCreateOption?: (query: string) => void
  createOptionLabel?: string | ((query: string) => string)
}

export function Select({
  id,
  name,
  label,
  error,
  value: controlledValue,
  defaultValue = '',
  onChange,
  onValueChange,
  options,
  children,
  placeholder = 'Select an option...',
  disabled = false,
  className,
  triggerClassName,
  dropdownClassName,
  searchable,
  align = 'start',
  ariaLabel,
  onCreateOption,
  createOptionLabel,
}: SelectProps) {
  // If neither options array nor onCreateOption nor searchable is provided, and children exist,
  // we can use standard Radix Select
  const isSearchableCustom = Boolean(onCreateOption || searchable || (options && options.length > 0))

  const [isOpen, setIsOpen] = useState(false)
  const [uncontrolledValue, setInternalValue] = useState(defaultValue)
  const [searchQuery, setSearchQuery] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const [dropdownCoords, setDropdownCoords] = useState<{ top: number; left: number; width: number; dropUp: boolean }>({
    top: 0,
    left: 0,
    width: 0,
    dropUp: false,
  })

  const triggerRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const isControlled = controlledValue !== undefined
  const activeValue = isControlled ? controlledValue : uncontrolledValue

  // Parse options from props or children (<option> / <SelectItem> tags)
  const parsedOptions: SelectOption[] = useMemo(() => {
    if (options && options.length > 0) return options
    if (!children) return []

    const extracted: SelectOption[] = []
    React.Children.forEach(children, (child) => {
      if (React.isValidElement(child)) {
        const { value, children: labelChildren, disabled: optDisabled } = child.props as any
        if (value !== undefined) {
          extracted.push({
            value: String(value),
            label: typeof labelChildren === 'string' ? labelChildren : String(value),
            disabled: Boolean(optDisabled),
          })
        }
      }
    })
    return extracted
  }, [options, children])

  const isSearchActive = isSearchableCustom && (searchable || parsedOptions.length >= 5 || Boolean(onCreateOption))

  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return parsedOptions
    const q = searchQuery.toLowerCase().trim()
    return parsedOptions.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        opt.value.toLowerCase().includes(q) ||
        (opt.description && opt.description.toLowerCase().includes(q)),
    )
  }, [parsedOptions, searchQuery])

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const triggerWidth = rect.width
    const minDropdownWidth = Math.max(triggerWidth, 220)
    const maxDropdownWidth = Math.min(Math.max(triggerWidth, 340), window.innerWidth - 24)
    const dropdownHeight = Math.min(filteredOptions.length * 36 + (isSearchActive ? 52 : 0) + 20, 280)

    const spaceBelow = window.innerHeight - rect.bottom
    const spaceAbove = rect.top
    const shouldDropUp = spaceBelow < dropdownHeight && spaceAbove > spaceBelow

    let left = align === 'end' ? rect.right - minDropdownWidth : rect.left
    if (left + minDropdownWidth > window.innerWidth - 12) {
      left = window.innerWidth - minDropdownWidth - 12
    }
    if (left < 12) left = 12

    const top = shouldDropUp ? rect.top - dropdownHeight - 6 : rect.bottom + 6

    setDropdownCoords({
      top,
      left,
      width: Math.min(Math.max(triggerWidth, minDropdownWidth), maxDropdownWidth),
      dropUp: shouldDropUp,
    })
  }, [align, filteredOptions.length, isSearchActive])

  const toggleOpen = () => {
    if (disabled) return
    if (!isOpen) updatePosition()
    setIsOpen(!isOpen)
  }

  useLayoutEffect(() => {
    if (isOpen) updatePosition()
  }, [isOpen, updatePosition])

  useEffect(() => {
    if (isOpen) {
      window.addEventListener('resize', updatePosition)
      window.addEventListener('scroll', updatePosition, true)
      return () => {
        window.removeEventListener('resize', updatePosition)
        window.removeEventListener('scroll', updatePosition, true)
      }
    }
  }, [isOpen, updatePosition])

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false)
        setSearchQuery('')
      }
    }
    if (isOpen) document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [isOpen])

  useEffect(() => {
    if (isOpen && isSearchActive) {
      const timer = setTimeout(() => searchInputRef.current?.focus(), 50)
      return () => clearTimeout(timer)
    }
  }, [isOpen, isSearchActive])

  const handleSelect = (val: string, isDisabled = false) => {
    if (isDisabled) return
    if (!isControlled) setInternalValue(val)
    if (onValueChange) onValueChange(val)
    if (onChange) onChange({ target: { value: val, name } } as any)
    setIsOpen(false)
    setSearchQuery('')
    triggerRef.current?.focus()
  }

  // Fallback to Radix when simple children and no custom search/create is needed
  if (!isSearchableCustom && !onCreateOption && !searchable) {
    return (
      <RX.Root value={controlledValue} defaultValue={defaultValue} onValueChange={onValueChange} disabled={disabled}>
        <RX.Trigger className={cn('rx-select-trigger', className, triggerClassName)} aria-label={ariaLabel}>
          <RX.Value placeholder={placeholder} />
          <RX.Icon className="rx-select-icon">
            <ChevronDown size={18} aria-hidden="true" />
          </RX.Icon>
        </RX.Trigger>
        <RX.Portal>
          <RX.Content className={cn('rx-surface', dropdownClassName)} position="popper" sideOffset={6}>
            <RX.Viewport>{children}</RX.Viewport>
          </RX.Content>
        </RX.Portal>
      </RX.Root>
    )
  }

  const selectedOpt = parsedOptions.find((o) => o.value === activeValue)

  return (
    <div className={cn('relative w-full', className)}>
      {label && <label htmlFor={id} className="label">{label}</label>}
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        onClick={toggleOpen}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel || label || placeholder}
        className={cn('rx-select-trigger', triggerClassName, error && 'border-red-500')}
      >
        <span className={cn('truncate', !selectedOpt && 'text-gray-400')}>
          {selectedOpt ? selectedOpt.label : placeholder}
        </span>
        <ChevronDown size={18} className="rx-select-icon" aria-hidden="true" />
      </button>

      {isOpen &&
        createPortal(
          <div
            ref={dropdownRef}
            style={{
              position: 'fixed',
              top: `${dropdownCoords.top}px`,
              left: `${dropdownCoords.left}px`,
              width: `${dropdownCoords.width}px`,
              zIndex: 'var(--z-dropdown, 9999)',
            }}
            className={cn('rx-surface p-1.5 shadow-xl border border-gray-200 rounded-xl bg-surface', dropdownClassName)}
          >
            {isSearchActive && (
              <div className="p-1 border-b border-gray-100 mb-1">
                <div className="relative flex items-center">
                  <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 pointer-events-none" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={`Search ${parsedOptions.length} options...`}
                    className="w-full pl-8 pr-7 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-md outline-none focus:border-[var(--color-primary-600)] text-text-primary"
                  />
                  {searchQuery && (
                    <button type="button" onClick={() => setSearchQuery('')} className="absolute right-2 p-0.5 text-gray-400 hover:text-text-primary">
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="max-h-56 overflow-y-auto space-y-0.5">
              {filteredOptions.length === 0 ? (
                <div className="py-3 px-2 space-y-2 text-center">
                  <p className="text-xs text-gray-500">
                    {searchQuery.trim() ? `No matching results for "${searchQuery}"` : 'No options available'}
                  </p>
                  {onCreateOption && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        const q = searchQuery.trim()
                        setIsOpen(false)
                        setSearchQuery('')
                        onCreateOption(q)
                      }}
                      className="w-full py-2 px-3 rounded-md bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>
                        {searchQuery.trim()
                          ? typeof createOptionLabel === 'function'
                            ? createOptionLabel(searchQuery.trim())
                            : createOptionLabel || `Add "${searchQuery.trim()}"`
                          : 'Add New'}
                      </span>
                    </button>
                  )}
                </div>
              ) : (
                <>
                  {filteredOptions.map((opt, idx) => {
                    const isSelected = opt.value === activeValue
                    const isHighlighted = idx === highlightedIndex
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        disabled={opt.disabled}
                        onClick={() => handleSelect(opt.value, opt.disabled)}
                        onMouseEnter={() => setHighlightedIndex(idx)}
                        className={cn(
                          'w-full flex items-center justify-between px-3 py-2 rounded-md text-xs text-left cursor-pointer transition-colors',
                          isSelected
                            ? 'bg-primary-600 text-white font-bold'
                            : isHighlighted
                            ? 'bg-primary-50 text-[var(--color-primary-800)]'
                            : 'text-text-primary hover:bg-gray-100',
                        )}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          {opt.icon && <span className="shrink-0">{opt.icon}</span>}
                          <span className="truncate">{opt.label}</span>
                        </div>
                        {isSelected && <Check className="w-3.5 h-3.5 text-white shrink-0 ml-2" />}
                      </button>
                    )
                  })}
                  {onCreateOption && (
                    <div className="pt-1 mt-1 border-t border-gray-100">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          const q = searchQuery.trim()
                          setIsOpen(false)
                          setSearchQuery('')
                          onCreateOption(q)
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs font-bold text-primary-600 hover:bg-primary-50 cursor-pointer text-left"
                      >
                        <Plus className="w-3.5 h-3.5 text-primary-600 shrink-0" />
                        <span className="truncate">
                          {searchQuery.trim()
                            ? typeof createOptionLabel === 'function'
                              ? createOptionLabel(searchQuery.trim())
                              : createOptionLabel || `Add "${searchQuery.trim()}"`
                            : 'Add New'}
                        </span>
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>,
          document.body,
        )}
      {error && <span className="field-error" role="alert">{error}</span>}
    </div>
  )
}

export function SelectItem({
  children,
  className,
  ...props
}: ComponentPropsWithoutRef<typeof RX.Item>) {
  return (
    <RX.Item className={cn('rx-item', className)} {...props}>
      <RX.ItemText>{children}</RX.ItemText>
      <RX.ItemIndicator className="rx-item-indicator">
        <Check size={16} aria-hidden="true" />
      </RX.ItemIndicator>
    </RX.Item>
  )
}
