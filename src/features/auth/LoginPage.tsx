import { SEO } from '../../components/layout/SEO'
import { APP_NAME } from '../../config/app.config'
import { PhoneStep } from './components/PhoneStep'
import { OtpStep } from './components/OtpStep'
import { useLogin } from './useLogin'
import './LoginPage.css'

export default function LoginPage() {
  const {
    step, phone, setPhone, otp, setOtp,
    loading, error, resendCooldown,
    handleSendOtp, handleVerifyOtp, handleResendOtp, handleBack,
  } = useLogin()

  return (
    <div className="login-page">
      <SEO title="Login" />

      <div className="login-page__card">
        <div className="login-page__header">
          <h1 className="login-page__title">{APP_NAME}</h1>
          <p className="login-page__subtitle">
            {step === 'phone' ? 'Sign in with your phone number' : 'Verify your identity'}
          </p>
        </div>

        {step === 'phone' ? (
          <PhoneStep
            phone={phone}
            onPhoneChange={setPhone}
            onSubmit={handleSendOtp}
            loading={loading}
            error={error}
          />
        ) : (
          <OtpStep
            phone={phone}
            otp={otp}
            onOtpChange={setOtp}
            onSubmit={handleVerifyOtp}
            onResend={handleResendOtp}
            onBack={handleBack}
            loading={loading}
            error={error}
            resendCooldown={resendCooldown}
          />
        )}
      </div>
    </div>
  )
}
