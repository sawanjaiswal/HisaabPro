import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { useJoinBusiness } from './useJoinBusiness';
import { JOIN_CODE_LENGTH } from './join-business.constants';
import './join-business.css';

export default function JoinBusiness() {
  const navigate = useNavigate();
  const {
    code,
    status,
    errorMsg,
    joinedName,
    isLoading,
    handleCodeChange,
    handleSubmit,
  } = useJoinBusiness();

  const isSuccess = status === 'success';

  return (
    <div className="join-business-page">
      <div className="join-business-card">

        {/* Back button */}
        <button
          className="join-business-back"
          onClick={() => navigate(-1)}
          aria-label="Go back"
          type="button"
        >
          <ArrowLeft className="join-business-back-icon" />
        </button>

        {/* Header */}
        <div className="join-business-header">
          <h1 className="join-business-title">Join a Business</h1>
          <p className="join-business-subtitle">
            Enter the 6-character invite code shared by the business owner
          </p>
        </div>

        {/* Success state */}
        {isSuccess ? (
          <div className="join-business-success" role="status" aria-live="polite">
            <CheckCircle className="join-business-success-icon" aria-hidden="true" />
            <p className="join-business-success-title">Joined {joinedName}!</p>
            <p className="join-business-success-msg">Redirecting to dashboard...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            {/* Code input */}
            <div className="join-business-field">
              <label htmlFor="join-code" className="join-business-label">
                Invite Code
              </label>
              <input
                id="join-code"
                className="join-business-code-input"
                type="text"
                inputMode="text"
                autoCapitalize="characters"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                placeholder="A1B2C3"
                value={code}
                maxLength={JOIN_CODE_LENGTH}
                onChange={(e) => handleCodeChange(e.target.value)}
                disabled={isLoading}
                aria-label="6-character invite code"
                aria-invalid={status === 'error'}
                aria-describedby={errorMsg ? 'join-code-error' : undefined}
              />
              {errorMsg && (
                <p
                  id="join-code-error"
                  className="join-business-error"
                  role="alert"
                  aria-live="assertive"
                >
                  {errorMsg}
                </p>
              )}
            </div>

            {/* Submit */}
            <Button
              type="submit"
              fullWidth
              loading={isLoading}
              disabled={code.length < JOIN_CODE_LENGTH || isLoading}
            >
              {isLoading ? 'Joining...' : 'Join Business'}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
