<template>
  <div class="login">
    <van-nav-bar title="登录" left-arrow @click-left="$router.back()" />

    <van-form @submit="handleLogin">
      <van-cell-group>
        <van-field
          v-model="form.phone"
          label="手机号"
          placeholder="请输入手机号"
          :rules="[{ required: true, message: '请输入手机号' }]"
        />
        <van-field
          v-model="form.code"
          label="验证码"
          placeholder="请输入验证码"
          :rules="[{ required: true, message: '请输入验证码' }]"
        >
          <template #button>
            <van-button size="small" type="primary" :disabled="countdown > 0" @click="sendCode">
              {{ countdown > 0 ? `${countdown}s` : '发送验证码' }}
            </van-button>
          </template>
        </van-field>
      </van-cell-group>
      <div style="margin: 16px;">
        <van-button round block type="primary" native-type="submit">
          登录
        </van-button>
      </div>
    </van-form>
  </div>
</template>

<script>
import axios from 'axios';

export default {
  name: 'Login',
  data() {
    return {
      form: {
        phone: '',
        code: '',
      },
      countdown: 0,
    };
  },
  methods: {
    async sendCode() {
      if (!this.form.phone) {
        this.$toast.fail('请输入手机号');
        return;
      }
      try {
        await axios.post('/api/user/send-code', { phone: this.form.phone });
        this.$toast.success('发送成功');
        this.countdown = 60;
        const timer = setInterval(() => {
          this.countdown--;
          if (this.countdown <= 0) {
            clearInterval(timer);
          }
        }, 1000);
      } catch (error) {
        this.$toast.fail('发送失败');
      }
    },
    async handleLogin() {
      try {
        const res = await axios.post('/api/user/login', this.form);
        localStorage.setItem('userId', res.data.data.userId);
        localStorage.setItem('token', res.data.data.token);
        this.$toast.success('登录成功');
        this.$router.back();
      } catch (error) {
        this.$toast.fail(error.response?.data?.message || '登录失败');
      }
    },
  },
};
</script>