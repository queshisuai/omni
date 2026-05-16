<template>
  <div class="activity">
    <van-nav-bar title="活动详情" left-arrow @click-left="$router.back()" />

    <div v-if="activity" class="activity-detail">
      <div class="poster">
        <img :src="activity.poster" :alt="activity.name" />
      </div>

      <div class="info">
        <h2>{{ activity.name }}</h2>
        <p>{{ activity.description }}</p>
        <div class="meta">
          <span>时间：{{ activity.time }}</span>
          <span>地点：{{ activity.venue }}</span>
        </div>
      </div>

      <div class="sessions">
        <h3>场次</h3>
        <div v-for="session in activity.sessions" :key="session.id" class="session-item">
          <div class="session-info">
            <span class="time">{{ session.time }}</span>
            <span class="status">{{ session.status }}</span>
          </div>
          <div v-if="session.canReserve" class="session-action">
            <van-button size="small" type="primary" @click="reserve(session.id)">
              预约
            </van-button>
          </div>
          <div v-if="session.canGrab" class="session-action">
            <van-button size="small" type="danger" @click="grab(session.id)">
              抢购
            </van-button>
          </div>
        </div>
      </div>

      <div class="ticket-types">
        <h3>票档</h3>
        <div v-for="ticketType in activity.ticketTypes" :key="ticketType.id" class="ticket-type">
          <span class="name">{{ ticketType.name }}</span>
          <span class="price">¥{{ ticketType.price }}</span>
          <span class="stock">剩余 {{ ticketType.stock }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import axios from 'axios';

export default {
  name: 'Activity',
  data() {
    return {
      activity: null,
    };
  },
  mounted() {
    this.loadActivity();
  },
  methods: {
    async loadActivity() {
      const id = this.$route.params.id;
      try {
        const res = await axios.get(`/api/ticket/activities/${id}`);
        this.activity = res.data.data;
      } catch (error) {
        console.error('加载活动失败', error);
      }
    },
    async reserve(sessionId) {
      const userId = localStorage.getItem('userId');
      if (!userId) {
        this.$router.push('/login');
        return;
      }
      try {
        await axios.post('/api/ticket/reserve', { userId, sessionId });
        this.$toast.success('预约成功');
        this.loadActivity();
      } catch (error) {
        this.$toast.fail(error.response?.data?.message || '预约失败');
      }
    },
    async grab(sessionId) {
      const userId = localStorage.getItem('userId');
      if (!userId) {
        this.$router.push('/login');
        return;
      }
      const ticketTypeId = this.activity.ticketTypes[0]?.id;
      try {
        const res = await axios.post('/grab/ticket', { userId, sessionId, ticketTypeId });
        if (res.data.success) {
          this.$toast.success('抢票成功');
        } else {
          this.$toast.fail(res.data.message);
        }
      } catch (error) {
        this.$toast.fail('抢票失败');
      }
    },
  },
};
</script>

<style scoped>
.activity-detail {
  padding-bottom: 60px;
}

.poster img {
  width: 100%;
  height: 200px;
  object-fit: cover;
}

.info {
  padding: 16px;
  background: #fff;
}

.info h2 {
  font-size: 18px;
  margin-bottom: 8px;
}

.info p {
  font-size: 14px;
  color: #666;
  margin-bottom: 12px;
}

.meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: #999;
}

.sessions, .ticket-types {
  padding: 16px;
  background: #fff;
  margin-top: 12px;
}

.sessions h3, .ticket-types h3 {
  font-size: 16px;
  margin-bottom: 12px;
}

.session-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: #f5f5f5;
  border-radius: 8px;
  margin-bottom: 8px;
}

.session-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.status {
  font-size: 12px;
  color: #999;
}

.ticket-type {
  display: flex;
  align-items: center;
  padding: 12px;
  background: #f5f5f5;
  border-radius: 8px;
  margin-bottom: 8px;
}

.ticket-type .name {
  flex: 1;
}

.ticket-type .price {
  color: #ff4d4f;
  font-weight: bold;
  margin-right: 12px;
}

.ticket-type .stock {
  font-size: 12px;
  color: #999;
}
</style>