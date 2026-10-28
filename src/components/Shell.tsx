import { ReactNode } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { Icon, DemoBadge } from './ui';
import { LangToggle } from './lang';

export type NavItem = { to: string; label: string; icon: Parameters<typeof Icon>[0]['name'] };
export const studentNav: NavItem[] = [
  { to: '/app', label: 'Dashboard', icon: 'home' }, { to: '/app/lesson', label: 'Curriculum', icon: 'layers' },
  { to: '/app/tutor', label: 'AI Tutor', icon: 'chat' }, { to: '/app/material', label: 'Learn from Your Material', icon: 'upload' },
  { to: '/app/tests', label: 'Weekly Tests', icon: 'test' }, { to: '/app/certificates', label: 'Certificates', icon: 'award' },
];
export const parentNav: NavItem[] = [{ to: '/parent', label: 'Overview', icon: 'home' }];
export const teacherNav: NavItem[] = [{ to: '/teacher/builder', label: 'Weekly tests', icon: 'test' }, { to: '/teacher/results', label: 'Results & analytics', icon: 'chart' }];
export const adminNav: NavItem[] = [{ to: '/admin/certificates', label: 'Certificates', icon: 'award' }];

export function Shell({ nav, user, role, children, mobileNav }: { nav: NavItem[]; user: { name: string; sub: string; initial: string }; role: string; children: ReactNode; mobileNav?: NavItem[] }) {
  const mn = (mobileNav ?? nav).slice(0, 5);
  return (
    <div className="shell">
      <aside className="side" aria-label="Main navigation">
        <Link to="/" className="logo"><span className="m"><Icon name="book" size={20} /></span>
          <span><b style={{ fontSize: 16 }}>Kalvi Mitra</b><br /><span className="muted small ta">{role}</span></span></Link>
        {nav.map(n => <NavLink key={n.to} to={n.to} end className={({ isActive }) => `nav ${isActive ? 'active' : ''}`}><Icon name={n.icon} />{n.label}</NavLink>)}
        <div className="usercard"><span className="avatar">{user.initial}</span><div><div className="semi small">{user.name}</div><div className="muted small">{user.sub}</div></div></div>
      </aside>
      <div className="main">
        <header className="topbar">
          <input className="search" placeholder="Search lessons, questions…" aria-label="Search" />
          <div className="grow" /><DemoBadge /><LangToggle />
          <button className="btn secondary" aria-label="Notifications" style={{ padding: 0, width: 40 }}><Icon name="bell" /></button>
        </header>
        <main className="content">{children}</main>
        <nav className="bottomnav" aria-label="Primary">
          {mn.map(n => <NavLink key={n.to} to={n.to} end className={({ isActive }) => (isActive ? 'active' : '')}><Icon name={n.icon} size={22} />{n.label.split(' ')[0]}</NavLink>)}
        </nav>
      </div>
    </div>
  );
}
export const StudentShell = ({ children }: { children: ReactNode }) => <Shell nav={studentNav} role="கல்வி மித்ரா" user={{ name: 'Meena', sub: 'Class 8 · English', initial: 'M' }} children={children} />;
