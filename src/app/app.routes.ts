import { Routes } from '@angular/router';
import { adminGuard, guestGuard, lockedGuard, memberGuard, pendingGuard, subscriptionGuard } from './core/guards';
import { Shell } from './layout/shell';

/** `title` values are translation keys (see core/i18n/title-strategy.ts). */
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'feed' },

  // ---- public / standalone pages ----
  {
    path: 'login',
    canActivate: [guestGuard],
    title: 'login.submit',
    loadComponent: () => import('./pages/auth/login').then((m) => m.LoginPage),
  },
  {
    path: 'register',
    canActivate: [guestGuard],
    title: 'register.title',
    loadComponent: () => import('./pages/auth/register').then((m) => m.RegisterPage),
  },
  {
    path: 'pending',
    canActivate: [pendingGuard],
    title: 'pending.title',
    loadComponent: () => import('./pages/auth/pending').then((m) => m.PendingPage),
  },

  {
    path: 'locked',
    canActivate: [lockedGuard],
    title: 'locked.title',
    loadComponent: () => import('./pages/billing/locked').then((m) => m.LockedPage),
  },

  // ---- app (approved members) ----
  {
    path: '',
    component: Shell,
    canActivate: [memberGuard],
    canActivateChild: [subscriptionGuard],
    children: [
      {
        path: 'feed',
        title: 'nav.feed',
        loadComponent: () => import('./pages/feed/feed').then((m) => m.FeedPage),
        children: [
          {
            path: ':postId',
            loadComponent: () => import('./pages/feed/post-sheet').then((m) => m.PostSheet),
          },
        ],
      },
      {
        path: 'new-post',
        title: 'create.title',
        loadComponent: () => import('./pages/feed/create-post').then((m) => m.CreatePostPage),
      },
      {
        path: 'chat',
        title: 'nav.chat',
        loadComponent: () => import('./pages/chat/chat').then((m) => m.ChatPage),
      },
      {
        path: 'polls',
        title: 'nav.polls',
        loadComponent: () => import('./pages/polls/polls').then((m) => m.PollsPage),
      },
      {
        path: 'fees',
        title: 'nav.fees',
        loadComponent: () => import('./pages/fees/fees').then((m) => m.FeesPage),
      },
      {
        path: 'craftsmen',
        title: 'nav.craftsmen',
        loadComponent: () => import('./pages/craftsmen/craftsmen').then((m) => m.CraftsmenPage),
      },
      {
        path: 'residents',
        title: 'nav.residents',
        loadComponent: () => import('./pages/residents/residents').then((m) => m.ResidentsPage),
      },
      {
        path: 'residents/:id',
        title: 'nav.residents',
        loadComponent: () => import('./pages/residents/resident-profile').then((m) => m.ResidentProfilePage),
      },
      {
        path: 'profile',
        title: 'nav.myProfile',
        loadComponent: () => import('./pages/profile/my-profile').then((m) => m.MyProfilePage),
      },
      {
        path: 'notifications',
        title: 'nav.notifications',
        loadComponent: () => import('./pages/notifications/notifications').then((m) => m.NotificationsPage),
      },
      {
        path: 'billing',
        canActivate: [adminGuard],
        title: 'nav.subscription',
        loadComponent: () => import('./pages/billing/billing').then((m) => m.BillingPage),
      },
      {
        path: 'admin',
        canActivate: [adminGuard],
        title: 'nav.admin',
        loadComponent: () => import('./pages/admin/admin-members').then((m) => m.AdminMembersPage),
      },
    ],
  },

  {
    path: '**',
    title: 'notFound.title',
    loadComponent: () => import('./pages/misc/not-found').then((m) => m.NotFoundPage),
  },
];
