<template>
  <div class="orders">
    <van-nav-bar title="我的订单" left-arrow @click-left="$router.back()" />

    <div v-if="orders.length === 0" class="empty">
      <p>暂无订单</p>
    </div>

    <div v-else class="order-list">
      <div v-for="order in orders" :key="order.id" class="order-item">
        <div class="order-info">
          <h4>{{ order.activityName }}</h4>
          <p>{{ order.sessionTime }} - {{ order.ticketTypeName }}</p>
          <p class="order-no">订单号：{{ order.orderNo }}</p>
        </div>
        <div class="order-status">
          <span :class="order.status">{{ order.statusText }}</span>
          <span class="price">¥{{ order.amount }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import axios from 'axios';

export default {
  name: 'Orders',
  data() {
    return {
      orders: [],
    };
  },
  mounted() {
    this.loadOrders();
  },
  methods: {
    async loadOrders() {
      const userId = localStorage.getItem('userId');
      if (!userId) {
        this.$router.push('/login');
        return;
      }
      try {
        const res = await axios.get(`/api/order/user/${userId}`);
        this.orders = res.data.data || [];
      } catch (error) {
        console.error('加载订单失败', error);
      }
    },
  },
};
</script>

<style scoped>
.empty {
  text-align: center;
  padding: 60px 0;
  color: #999;
}

.order-list {
  padding: 12px;
}

.order-item {
  background: #fff;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 12px;
  display: flex;
  justify-content: space-between;
}

.order-info h4 {
  font-size: 16px;
  margin-bottom: 8px;
}

.order-info p {
  font-size: 12px;
  color: #666;
  margin-bottom: 4px;
}

.order-no {
  font-size: 12px;
  color: #999;
}

.order-status {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: space-between;
}

.order-status .price {
  font-size: 16px;
  color: #ff4d4f;
  font-weight: bold;
}

.order-status .PENDING {
  color: #1989fa;
}

.order-status .PAID {
  color: #07c160;
}

.order-status .CANCELLED {
  color: #999;
}
</style>