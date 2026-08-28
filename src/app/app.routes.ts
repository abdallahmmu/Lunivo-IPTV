import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/landing/landing-page').then((m) => m.LandingPage),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/main-layout/main-layout').then((m) => m.MainLayout),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'home' },
      { path: 'home', loadComponent: () => import('./features/home/home-page').then((m) => m.HomePage) },
      { path: 'live-tv', loadComponent: () => import('./features/live-tv/live-tv-page').then((m) => m.LiveTvPage) },
      { path: 'movies', loadComponent: () => import('./features/movies/movies-page').then((m) => m.MoviesPage) },
      { path: 'movies/:id', loadComponent: () => import('./features/movies/movie-detail-page').then((m) => m.MovieDetailPage) },
      { path: 'series', loadComponent: () => import('./features/series/series-page').then((m) => m.SeriesPage) },
      { path: 'series/:id', loadComponent: () => import('./features/series/series-detail-page').then((m) => m.SeriesDetailPage) },
      { path: 'favorites', loadComponent: () => import('./features/favorites/favorites-page').then((m) => m.FavoritesPage) },
      { path: 'history', loadComponent: () => import('./features/history/history-page').then((m) => m.HistoryPage) },
      { path: 'search', loadComponent: () => import('./features/search/search-page').then((m) => m.SearchPage) },
      { path: 'settings', loadComponent: () => import('./features/settings/settings-page').then((m) => m.SettingsPage) },
      { path: '**', redirectTo: 'home' },
    ],
  },
  { path: '**', redirectTo: 'login' },
];
