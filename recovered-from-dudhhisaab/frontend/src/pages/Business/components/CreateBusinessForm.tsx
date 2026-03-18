import { useState, useRef } from 'react';
import { businessAPI } from '../../../services/api';
import { useToast } from '../../../hooks/useToast';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { BUSINESS_TYPE_OPTIONS, BUSINESS_NAME_MIN_LENGTH } from '../business-management.constants';
import { validateBusinessName } from '../business-management.utils';
import type { CreateBusinessFormProps } from '../business-management.types';

export function CreateBusinessForm({ onClose, onCreated }: CreateBusinessFormProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<string>(BUSINESS_TYPE_OPTIONS[0].value);
  const [nameError, setNameError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Double-submit guard
  const submittingRef = useRef(false);
  const toast = useToast();

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
    if (nameError) setNameError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;

    const nameValidationError = validateBusinessName(name);
    if (nameValidationError) {
      setNameError(nameValidationError);
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);
    setNameError(null);

    try {
      const result = await businessAPI.create({ name: name.trim(), type });
      toast.success(`"${result.business.name}" created!`);
      onCreated(result.tokens);
    } catch (err: unknown) {
      const apiMsg = (err as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message;
      toast.error(apiMsg ?? 'Failed to create business. Please try again.');
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="create-biz-form">
      <h2 className="create-biz-title">Create New Business</h2>
      <p className="create-biz-subtitle">
        Each business has its own data, customers and team.
      </p>

      {/* Business name */}
      <div className="create-biz-field">
        <label htmlFor="biz-name" className="create-biz-label">
          Business Name <span aria-hidden="true">*</span>
        </label>
        <Input
          id="biz-name"
          type="text"
          placeholder="e.g. Sharma Dairy"
          value={name}
          onChange={handleNameChange}
          disabled={isSubmitting}
          minLength={BUSINESS_NAME_MIN_LENGTH}
          maxLength={80}
          autoFocus
          aria-required="true"
          aria-invalid={!!nameError}
          aria-describedby={nameError ? 'biz-name-error' : undefined}
          error={nameError ?? undefined}
        />
        {nameError && (
          <p id="biz-name-error" className="create-biz-error" role="alert">
            {nameError}
          </p>
        )}
      </div>

      {/* Business type */}
      <div className="create-biz-field">
        <label htmlFor="biz-type" className="create-biz-label">
          Business Type
        </label>
        <select
          id="biz-type"
          className="create-biz-select"
          value={type}
          onChange={(e) => setType(e.target.value)}
          disabled={isSubmitting}
          aria-label="Business type"
        >
          {BUSINESS_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Actions */}
      <div className="create-biz-actions">
        <Button
          type="button"
          variant="secondary"
          fullWidth
          onClick={onClose}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          fullWidth
          loading={isSubmitting}
          disabled={name.trim().length < BUSINESS_NAME_MIN_LENGTH || isSubmitting}
        >
          {isSubmitting ? 'Creating...' : 'Create Business'}
        </Button>
      </div>
    </form>
  );
}
