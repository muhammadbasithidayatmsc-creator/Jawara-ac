import React, { useEffect, useState } from 'react';
import { AlertCircle, Eye, EyeOff, Lock, Mail, ShieldCheck, User } from 'lucide-react';
import { JawaraLogo } from '../components/JawaraLogo';
import { api, formatApiError, setAuthToken } from '../lib/api';
import type { Profile } from '../types/database';

interface LoginPageProps {
  onLoginSuccess: (profile: Profile) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);

  const [fullName, setFullName] = useState('Admin JAWARA AC');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    let active = true;
    api
      .authStatus()
      .then((res) => {
        if (active) setNeedsSetup(res.needsSetup);
      })
      .catch(() => {
        if (active) setNeedsSetup(false);
      })
      .finally(() => {
        if (active) setCheckingStatus(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !password) {
      setErrorMsg('Email dan password wajib diisi.');
      return;
    }

    if (needsSetup) {
      if (password.length < 6) {
        setErrorMsg('Password Admin minimal 6 karakter.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMsg('Konfirmasi password tidak cocok.');
        return;
      }
    }

    setLoading(true);
    try {
      const res = needsSetup
        ? await api.setupFirstAdmin({
            email: trimmedEmail,
            password,
            full_name: fullName.trim() || 'Admin JAWARA AC',
          })
        : await api.login({
            email: trimmedEmail,
            password,
          });

      setAuthToken(res.token);
      onLoginSuccess(res.profile);
    } catch (err) {
      setErrorMsg(formatApiError(err, 'Gagal memproses autentikasi Admin.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-5xl bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden grid grid-cols-1 lg:grid-cols-2 items-stretch">
        {/* Left Visual Panel */}
        <div className="bg-navy-900 text-white p-6 sm:p-10 flex flex-col justify-between relative overflow-hidden">
          <div className="relative z-10">
            <JawaraLogo variant="light" showTagline />
            <h1 className="text-2xl sm:text-3xl font-bold mt-8 leading-tight [text-wrap:balance]">
              Kelola Operasional &amp; Keuangan Service AC dalam Satu Sistem
            </h1>
            <p className="text-sm text-slate-300 mt-3 leading-relaxed max-w-md">
              Catat order masuk, jadwal teknisi, rincian pekerjaan, pembayaran DP maupun lunas, invoice PDF, hingga laporan laba bersih secara praktis langsung di browser perangkat Anda.
            </p>
          </div>

          <div className="mt-8 rounded-xl overflow-hidden border border-white/10 bg-navy-800 aspect-[4/3]">
            {!imgError ? (
              <img
                src="/src/assets/images/jawara_ac_service_1795747885276.jpg"
                alt="Unit AC Split JAWARA AC di ruangan modern"
                referrerPolicy="no-referrer"
                onError={() => setImgError(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-navy-800 to-blue-900 p-6 text-center">
                <div>
                  <p className="text-lg font-bold text-white">JAWARA AC</p>
                  <p className="text-xs text-sky-200 mt-1">Manajemen Service AC Profesional</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Form Panel */}
        <div className="p-6 sm:p-10 lg:p-12 flex flex-col justify-center">
          <div className="max-w-md w-full mx-auto">
            <div className="lg:hidden mb-6">
              <JawaraLogo variant="dark" showTagline />
            </div>

            {checkingStatus ? (
              <div className="py-12 text-center text-sm text-slate-500">
                Menyiapkan database lokal JAWARA AC...
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 text-blue-700 text-xs font-semibold mb-1.5">
                  <ShieldCheck className="w-4 h-4" />
                  <span>{needsSetup ? 'Inisialisasi Sistem Baru' : 'Akses Administrator'}</span>
                </div>
                <h2 className="text-2xl font-bold text-slate-900">
                  {needsSetup ? 'Aktivasi Akun Admin Pertama' : 'Masuk Dashboard Admin'}
                </h2>
                <p className="text-sm text-slate-500 mt-1.5">
                  {needsSetup
                    ? 'Database browser masih kosong. Buat email dan password Admin lokal untuk mulai menggunakan JAWARA AC.'
                    : 'Masukkan email dan password Admin untuk membuka dashboard operasional JAWARA AC.'}
                </p>

                {errorMsg && (
                  <div
                    role="alert"
                    className="mt-5 p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-sm text-red-700"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                  {needsSetup && (
                    <div>
                      <label htmlFor="admin-name" className="block text-sm font-semibold text-slate-700 mb-1.5">
                        Nama Lengkap Admin
                      </label>
                      <div className="relative">
                        <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          id="admin-name"
                          type="text"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="Admin JAWARA AC"
                          required
                          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 min-h-[44px]"
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label htmlFor="admin-email" className="block text-sm font-semibold text-slate-700 mb-1.5">
                      Email Admin
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        id="admin-email"
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="admin@jawaraac.com"
                        required
                        className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 min-h-[44px]"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="admin-password" className="block text-sm font-semibold text-slate-700 mb-1.5">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        id="admin-password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete={needsSetup ? 'new-password' : 'current-password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={needsSetup ? 'Minimal 6 karakter' : 'Masukkan password'}
                        required
                        className="w-full pl-10 pr-11 py-2.5 rounded-lg border border-slate-300 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 min-h-[44px]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 rounded"
                        aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {needsSetup && (
                    <div>
                      <label htmlFor="admin-password-confirm" className="block text-sm font-semibold text-slate-700 mb-1.5">
                        Konfirmasi Password
                      </label>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          id="admin-password-confirm"
                          type={showPassword ? 'text' : 'password'}
                          autoComplete="new-password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Ulangi password"
                          required
                          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 min-h-[44px]"
                        />
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-colors min-h-[46px] disabled:opacity-60 mt-2"
                  >
                    {loading
                      ? 'Memproses...'
                      : needsSetup
                      ? 'Aktifkan Admin & Masuk'
                      : 'Masuk ke JAWARA AC'}
                  </button>
                </form>

                <p className="text-xs text-slate-500 mt-6 leading-relaxed">
                  Seluruh data tersimpan permanen di database lokal browser (IndexedDB) tanpa server terpisah dan dapat di-backup atau dipulihkan kapan saja dalam format JSON. Login lokal ini digunakan untuk pembatasan akses antarmuka pada perangkat ini.
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
