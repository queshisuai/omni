import { createApp } from 'vue';
import { Button, NavBar, Tabbar, TabbarItem, Cell, CellGroup, Field, Form, Toast } from 'vant';
import App from './App.vue';
import router from './router';

const app = createApp(App);

app.use(router);
app.use(Button);
app.use(NavBar);
app.use(Tabbar);
app.use(TabbarItem);
app.use(Cell);
app.use(CellGroup);
app.use(Field);
app.use(Form);
app.use(Toast);

app.mount('#app');