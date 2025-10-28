// ===== SECTION 1: IMPORTS =====
import { evntBus } from '../../bus';
import format from '../../format';

// CONSTANTS
const EVENT_NAMES = {
  SHOW_OFFERS: 'show_offers',
  SHOW_MESSAGE: 'show_mesage',
  UPDATE_INVOICE_OFFERS: 'update_invoice_offers',
  UPDATE_OFFERS_COUNTERS: 'update_offers_counters',
  REGISTER_POS_PROFILE: 'register_pos_profile',
  UPDATE_CUSTOMER: 'update_customer',
  SET_OFFERS: 'set_offers',
  UPDATE_POS_OFFERS: 'update_pos_offers',
  UPDATE_DISCOUNT_PERCENTAGE_OFFER_NAME: 'update_discount_percentage_offer_name',
  SET_ALL_ITEMS: 'set_all_items',
};

const OFFER_TYPES = {
  GRAND_TOTAL: 'Grand Total',
  GIVE_PRODUCT: 'Give Product',
};

const APPLY_TYPES = {
  ITEM_CODE: 'Item Code',
  ITEM_GROUP: 'Item Group',
};

const ITEMS_HEADERS = [
  { title: 'Name', key: 'name', align: 'start' },
  { title: 'Apply On', key: 'apply_on', align: 'start' },
  { title: 'Offer', key: 'offer', align: 'start' },
  { title: 'Applied', key: 'offer_applied', align: 'start' },
];

// ===== SECTION 2: EXPORT DEFAULT =====
export default {
  mixins: [format],

  // ===== SECTION 3: DATA =====
  data() {
    return {
      loading: false,
      pos_profile: '',
      pos_offers: [],
      allItems: [],
      discount_percentage_offer_name: null,
      itemsPerPage: 1000,
      expanded: [],
      singleExpand: true,
      items_headers: ITEMS_HEADERS,
    };
  },

  // ===== SECTION 4: COMPUTED =====
  computed: {
    offersEnabled() {
      const value = this.pos_profile?.posa_auto_fetch_offers;

      const enabled =
        value !== 0 && value !== '0' && value !== false && value !== null && value !== undefined;

      return enabled;
    },
    offersCount() {
      return this.pos_offers.length;
    },
    appliedOffersCount() {
      return this.pos_offers.filter((el) => el.offer_applied).length;
    },
  },

  // ===== SECTION 5: METHODS =====
  methods: {
    back_to_invoice() {
      evntBus.emit(EVENT_NAMES.SHOW_OFFERS, 'false');
    },

    handleOfferToggle() {
      this.pos_offers = [...this.pos_offers];
      this.handleManualOfferChange();
    },

    toggleOffer(offer) {
      if (!this.isOfferDisabled(offer)) {
        offer.offer_applied = !offer.offer_applied;
        this.handleOfferToggle();
      }

      // Create a normalized offer object with all necessary fields for Invoice.js
      const normalizedOffer = {
        ...offer,
        name: offer.name || offer.offer_name,
        offer_name: offer.offer_name || offer.name,
        // Ensure offer_type is set for Invoice.js logic
        offer_type: offer.offer_type || this.inferOfferType(offer),
      };

      if (offer.offer_applied) {
        this.$emit('offerApplied', normalizedOffer);
      } else {
        // Pass the normalized offer object so Invoice.js knows which offer was removed
        this.$emit('offerRemoved', normalizedOffer);
      }
    },

    inferOfferType(offer) {
      // Infer offer_type from other fields if not present
      // This handles cases where backend uses different field naming

      if (offer.item_code) return 'item_code';
      if (offer.item_group) return 'item_group';
      if (offer.brand) return 'brand';
      if (offer.customer) return 'customer';
      if (offer.customer_group) return 'customer_group';

      // Check legacy 'offer' field (e.g., "Grand Total")
      if (offer.offer === 'Grand Total' || offer.apply_on === 'Grand Total') {
        return 'grand_total';
      }

      // Default to grand_total for transaction-level offers
      return 'grand_total';
    },

    isOfferDisabled(offer) {
      return Boolean(
        (offer.offer_type === 'Give Product' &&
          !offer.give_item &&
          (!offer.replace_cheapest_item || !offer.replace_item)) ||
          (offer.offer_type === 'Grand Total' &&
            this.discount_percentage_offer_name &&
            this.discount_percentage_offer_name !== offer.name),
      );
    },

    truncateName(name, maxLength) {
      return name && name.length > maxLength ? name.substring(0, maxLength) + '...' : name;
    },

    handleImageError(event) {
      event.target.src = '/assets/posawesome/js/posapp/components/pos/placeholder-image.png';
    },

    handleManualOfferChange() {
      try {
        const appliedGrandTotalOffers = this.pos_offers.filter(
          (offer) => offer.offer === OFFER_TYPES.GRAND_TOTAL && offer.offer_applied,
        );

        if (appliedGrandTotalOffers.length > 1) {
          this.applyBestGrandTotalOffer();
        } else if (appliedGrandTotalOffers.length === 1) {
          this.discount_percentage_offer_name = appliedGrandTotalOffers[0].name;
          this.pos_offers.forEach((offer) => {
            if (
              offer.offer === OFFER_TYPES.GRAND_TOTAL &&
              offer.name !== appliedGrandTotalOffers[0].name
            ) {
              offer.offer_applied = false;
            }
          });
        } else {
          this.discount_percentage_offer_name = null;
        }
      } catch (error) {
        console.error('[ERROR] handleManualOfferChange exception:', error);
        this.showMessage('Error processing offer change', 'error');
      }
    },

    makeid(length) {
      const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
      return Array.from({ length }, () =>
        characters.charAt(Math.floor(Math.random() * characters.length)),
      ).join('');
    },

    updatePosOffers(appliedOffers) {
      try {
        this.pos_offers.forEach((pos_offer) => {
          const wasApplied = pos_offer.offer_applied;
          pos_offer.offer_applied = appliedOffers.some(
            (offer) =>
              offer.name === pos_offer.name ||
              offer.offer_name === pos_offer.name ||
              offer.name === pos_offer.title,
          );
        });
      } catch (error) {
        console.error('[ERROR] updatePosOffers exception:', error);
      }
    },

    applyBestGrandTotalOffer() {
      try {
        const grandTotalOffers = this.pos_offers.filter(
          (offer) => offer.offer === OFFER_TYPES.GRAND_TOTAL,
        );

        if (grandTotalOffers.length === 0) return;

        if (grandTotalOffers.length > 1) {
          grandTotalOffers.sort((a, b) => {
            const discountA = parseFloat(a.discount_percentage || 0);
            const discountB = parseFloat(b.discount_percentage || 0);
            return discountB - discountA;
          });

          grandTotalOffers.forEach((offer) => (offer.offer_applied = false));
          grandTotalOffers[0].offer_applied = true;
          this.discount_percentage_offer_name = grandTotalOffers[0].name;
          this.showMessage('Best offer applied: ' + grandTotalOffers[0].name, 'success');
        } else {
          grandTotalOffers[0].offer_applied = true;
          this.discount_percentage_offer_name = grandTotalOffers[0].name;
        }
      } catch (error) {
        this.showMessage('Error applying best offer', 'error');
      }
    },

    removeOffers(offers_id_list) {
      try {
        this.pos_offers = this.pos_offers.filter(
          (offer) => !offers_id_list.includes(offer.name || offer.offer_name),
        );
      } catch (error) {
        this.showMessage('Error removing offers', 'error');
      }
    },

    handelOffers() {
      try {
        const applyedOffers = this.pos_offers.filter((offer) => offer.offer_applied);
        evntBus.emit(EVENT_NAMES.UPDATE_INVOICE_OFFERS, applyedOffers);
      } catch (error) {
        this.showMessage('Error processing offers', 'error');
      }
    },

    handleNewLine(str) {
      return str ? str.replace(/(?:\r\n|\r|\n)/g, '<br />') : '';
    },

    get_give_items(offer) {
      try {
        if (offer.apply_type === APPLY_TYPES.ITEM_CODE) {
          return [offer.apply_item_code];
        }

        if (offer.apply_type === APPLY_TYPES.ITEM_GROUP) {
          let filterd_items = this.allItems.filter(
            (item) => item.item_group === offer.apply_item_group,
          );

          if (offer.less_then > 0) {
            filterd_items = filterd_items.filter((item) => item.rate < offer.less_then);
          }

          return filterd_items;
        }

        return [];
      } catch (error) {
        this.showMessage('Error getting free items', 'error');
        return [];
      }
    },

    updateCounters() {
      try {
        evntBus.emit(EVENT_NAMES.UPDATE_OFFERS_COUNTERS, {
          offersCount: this.offersCount,
          appliedOffersCount: this.appliedOffersCount,
        });
      } catch (error) {
        this.showMessage('Error updating counters', 'error');
      }
    },

    showMessage(text, color) {
      evntBus.emit(EVENT_NAMES.SHOW_MESSAGE, { text, color });
    },
  },

  // ===== SECTION 6: WATCH =====
  watch: {
    pos_offers: {
      deep: true,
      handler() {
        this.handelOffers();
        this.updateCounters();
      },
    },
  },

  // ===== SECTION 7: CREATED =====
  created() {
    this.$nextTick(() => {
      evntBus.on(EVENT_NAMES.REGISTER_POS_PROFILE, (data) => {
        this.pos_profile = data.pos_profile;
      });

      evntBus.on(EVENT_NAMES.UPDATE_CUSTOMER, (customer) => {
        if (this.customer !== customer) {
          this.offers = [];
        }
      });

      evntBus.on(EVENT_NAMES.SET_OFFERS, (data) => {
        this.pos_offers = data.map((offer) => ({
          ...offer,
          offer_applied: !!offer.auto,
        }));
      });

      evntBus.on(EVENT_NAMES.UPDATE_POS_OFFERS, (data) => {
        this.updatePosOffers(data);
      });

      evntBus.on(EVENT_NAMES.UPDATE_DISCOUNT_PERCENTAGE_OFFER_NAME, (data) => {
        this.discount_percentage_offer_name = data.value;
      });

      evntBus.on(EVENT_NAMES.SET_ALL_ITEMS, (data) => {
        this.allItems = data;
      });
    });
  },

  beforeDestroy() {
    // Clean up all event listeners
    evntBus.$off(EVENT_NAMES.REGISTER_POS_PROFILE);
    evntBus.$off(EVENT_NAMES.UPDATE_CUSTOMER);
    evntBus.$off(EVENT_NAMES.SET_OFFERS);
    evntBus.$off(EVENT_NAMES.UPDATE_POS_OFFERS);
    evntBus.$off(EVENT_NAMES.UPDATE_DISCOUNT_PERCENTAGE_OFFER_NAME);
    evntBus.$off(EVENT_NAMES.SET_ALL_ITEMS);
  },
};
