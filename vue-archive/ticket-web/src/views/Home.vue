<template>
  <div class="home">
    <van-nav-bar title="大麦抢票" />

    <div class="activity-list">
      <div v-for="activity in activities" :key="activity.id" class="activity-item" @click="goActivity(activity.id)">
        <div class="activity-cover">
          <img :src="activity.poster" :alt="activity.name" />
        </div>
        <div class="activity-info">
          <h3>{{ activity.name }}</h3>
          <p class="time">{{ activity.time }}</p>
          <p class="venue">{{ activity.venue }}</p>
          <div class="price">
            <span class="price-label">票价</span>
            <span class="price-value">¥{{ activity.minPrice }}-{{ activity.maxPrice }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import axios from 'axios';

export default {
  name: 'Home',
  data() {
    return {
      activities: [],
    };
  },
  mounted() {
    this.loadActivities();
  },
  methods: {
    async loadActivities() {
      try {
        const res = await axios.get('/api/ticket/activities');
        this.activities = res.data.data || [];
      } catch (error) {
        console.error('加载活动列表失败', error);
      }
    },
    goActivity(id) {
      this.$router.push(`/activity/${id}`);
    },
  },
};
</script>

<style scoped>
.home {
  padding-bottom: 60px;
}

.activity-list {
  padding: 12px;
}

.activity-item {
  background: #fff;
  border-radius: 8px;
  margin-bottom: 12px;
  overflow: hidden;
  display: flex;
}

.activity-cover {
  width: 100px;
  height: 100px;
}

.activity-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.activity-info {
  flex: 1;
  padding: 12px;
}

.activity-info h3 {
  font-size: 16px;
  margin-bottom: 8px;
}

.activity-info p {
  font-size: 12px;
  color: #999;
  margin-bottom: 4px;
}

.price {
  margin-top: 8px;
}

.price-label {
  font-size: 12px;
  color: #999;
}

.price-value {
  font-size: 16px;
  color: #ff4d4f;
  font-weight: bold;
}
</style>