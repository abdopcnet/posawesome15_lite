import Navbar from './components/Navbar.vue';
import POS from './components/pos/Pos.vue';

export default {
  data: function () {
    return {
      page: 'POS',
    };
  },
  components: {
    Navbar,
    POS,
  },
  methods: {
    setPage(page) {
      this.page = page;
    },
  },
};
