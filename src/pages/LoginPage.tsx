import { useState } from 'react';
import { signIn, signUp } from '../lib/auth';
import { Trophy, Key, User, Mail, Lock, Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [inviteCode, setInviteCode] = useState('');

  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleSubmit() {
    setError('');
    setSuccess('');
    if (!email || !password) { setError('נא למלא אימייל וסיסמה'); return; }
    if (mode === 'register' && !displayName) { setError('נא למלא שם תצוגה'); return; }
    if (mode === 'register' && !inviteCode) { setError('נא להזין קוד הזמנה'); return; }

    setLoading(true);
    try {
      if (mode === 'login') {
        await signIn(email, password);
      } else {
        await signUp(email, password, displayName, inviteCode);
        setSuccess('נרשמת בהצלחה! בדוק את האימייל שלך לאישור.');
      }
    } catch (e: any) {
      setError(e.message || 'שגיאה, נסה שנית');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="pitch-bg flex items-center justify-center p-4" style={{ minHeight: '100dvh' }}>
      <div className="w-full max-w-md fade-in">
        {/* לוגו */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-4"
               style={{background: 'rgba(0,200,83,0.15)', border: '2px solid rgba(0,200,83,0.4)'}}>
            <Trophy size={36} style={{color: 'var(--green)'}} />
          </div>
          <h1 className="bebas text-5xl tracking-wider" style={{color: 'var(--text)'}}>מונדיאל הימורים</h1>
          <p style={{color: 'var(--text-muted)'}} className="mt-1 text-sm">טורניר חברים — בלבד בהזמנה</p>
        </div>

        {/* כרטיס */}
        <div className="card p-6">
          {/* טאבים */}
          <div className="flex gap-2 mb-6" style={{background: 'var(--surface2)', borderRadius: '10px', padding: '4px'}}>
            <button
              onClick={() => { setMode('login'); setError(''); }}
              className="flex-1 py-2 rounded-lg text-sm font-600 transition-all"
              style={mode === 'login' ? {background: 'var(--green)', color: '#000', fontWeight: 700} : {color: 'var(--text-muted)'}}
            >כניסה</button>
            <button
              onClick={() => { setMode('register'); setError(''); }}
              className="flex-1 py-2 rounded-lg text-sm transition-all"
              style={mode === 'register' ? {background: 'var(--green)', color: '#000', fontWeight: 700} : {color: 'var(--text-muted)'}}
            >הרשמה</button>
          </div>

          <form className="flex flex-col gap-4" onSubmit={e => { e.preventDefault(); handleSubmit(); }}>
            {mode === 'register' && (
              <div className="relative">
                <User size={16} className="absolute top-1/2 -translate-y-1/2" style={{left: 'auto', right: '14px', color: 'var(--text-muted)'}} />
                <input className="input" style={{paddingRight: '40px'}} placeholder="שם תצוגה" value={displayName} onChange={e => setDisplayName(e.target.value)} />
              </div>
            )}

            <div className="relative">
              <Mail size={16} className="absolute top-1/2 -translate-y-1/2" style={{left: 'auto', right: '14px', color: 'var(--text-muted)'}} />
              <input className="input" style={{paddingRight: '40px'}} type="email" placeholder="אימייל" value={email} onChange={e => setEmail(e.target.value)} />
            </div>

            <div className="relative">
              <Lock size={16} className="absolute top-1/2 -translate-y-1/2" style={{left: 'auto', right: '14px', color: 'var(--text-muted)'}} />
              <input
                className="input"
                style={{paddingRight: '40px', paddingLeft: '40px'}}
                type={showPass ? 'text' : 'password'}
                placeholder="סיסמה"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
              <button onClick={() => setShowPass(!showPass)} className="absolute top-1/2 -translate-y-1/2" style={{right: 'auto', left: '14px', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer'}}>
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {mode === 'register' && (
              <div className="relative">
                <Key size={16} className="absolute top-1/2 -translate-y-1/2" style={{left: 'auto', right: '14px', color: 'var(--text-muted)'}} />
                <input
                  className="input"
                  style={{paddingRight: '40px', letterSpacing: '2px', textTransform: 'uppercase'}}
                  placeholder="קוד הזמנה"
                  value={inviteCode}
                  onChange={e => setInviteCode(e.target.value.toUpperCase())}
                />
              </div>
            )}

            {error && (
              <div className="text-sm px-3 py-2 rounded-lg" style={{background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)'}}>
                {error}
              </div>
            )}

            {success && (
              <div className="text-sm px-3 py-2 rounded-lg" style={{background: 'rgba(0,200,83,0.1)', color: 'var(--green)', border: '1px solid rgba(0,200,83,0.2)'}}>
                {success}
              </div>
            )}

            <button className="btn-primary" type="submit" disabled={loading}>
              {loading ? 'טוען...' : mode === 'login' ? 'כניסה' : 'הרשמה'}
            </button>
          </form>
        </div>

        <p className="text-center mt-4 text-xs" style={{color: 'var(--text-muted)'}}>
          אין לך הזמנה? פנה למנהל הטורניר
        </p>
      </div>
    </div>
  );
}
