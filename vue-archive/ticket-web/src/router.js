import { createRouter, createWebHistory } from 'vue-router';

const routes = [
  {
    path: '/',
    name: 'Home',
    component: () => import('./views/Home.vue'),
  },
  {
    path: '/activity/:id',
    name: 'Activity',
    component: () => import('./views/Activity.vue'),
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('./views/Login.vue'),
  },
  {
    path: '/orders',
    name: 'Orders',
    component: () => import('./views/Orders.vue'),
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;