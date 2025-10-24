# -*- coding: utf-8 -*-
"""
Redis Caching Implementation for POS Awesome Lite
Provides caching layer for frequently accessed data
"""

import json
import frappe
from frappe import _
import time
from typing import Any, Optional, Dict, List

class RedisCache:
    """
    Redis caching implementation for POS Awesome Lite
    """
    
    def __init__(self):
        self.redis_client = None
        self.cache_enabled = False
        self.default_ttl = 300  # 5 minutes default TTL
        
        # Initialize Redis connection
        self._initialize_redis()
    
    def _initialize_redis(self):
        """
        Initialize Redis connection
        """
        try:
            import redis
            
            # Get Redis configuration from site config
            redis_config = frappe.get_conf().get('redis_cache', {})
            
            if redis_config.get('enabled', False):
                self.redis_client = redis.Redis(
                    host=redis_config.get('host', 'localhost'),
                    port=redis_config.get('port', 6379),
                    db=redis_config.get('db', 0),
                    password=redis_config.get('password'),
                    decode_responses=True
                )
                
                # Test connection
                self.redis_client.ping()
                self.cache_enabled = True
                
                frappe.logger().info("Redis cache initialized successfully")
            else:
                frappe.logger().info("Redis cache disabled in configuration")
                
        except Exception as e:
            frappe.logger().warning(f"Redis cache initialization failed: {str(e)}")
            self.cache_enabled = False
    
    def get(self, key: str) -> Optional[Any]:
        """
        Get value from cache
        """
        if not self.cache_enabled:
            return None
            
        try:
            cached_value = self.redis_client.get(key)
            if cached_value:
                return json.loads(cached_value)
            return None
        except Exception as e:
            frappe.logger().error(f"Cache get error for key {key}: {str(e)}")
            return None
    
    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> bool:
        """
        Set value in cache
        """
        if not self.cache_enabled:
            return False
            
        try:
            ttl = ttl or self.default_ttl
            serialized_value = json.dumps(value, default=str)
            self.redis_client.setex(key, ttl, serialized_value)
            return True
        except Exception as e:
            frappe.logger().error(f"Cache set error for key {key}: {str(e)}")
            return False
    
    def delete(self, key: str) -> bool:
        """
        Delete key from cache
        """
        if not self.cache_enabled:
            return False
            
        try:
            self.redis_client.delete(key)
            return True
        except Exception as e:
            frappe.logger().error(f"Cache delete error for key {key}: {str(e)}")
            return False
    
    def clear_pattern(self, pattern: str) -> int:
        """
        Clear all keys matching pattern
        """
        if not self.cache_enabled:
            return 0
            
        try:
            keys = self.redis_client.keys(pattern)
            if keys:
                return self.redis_client.delete(*keys)
            return 0
        except Exception as e:
            frappe.logger().error(f"Cache clear pattern error for {pattern}: {str(e)}")
            return 0

# Global cache instance
cache = RedisCache()

def get_cached_items(pos_profile: str, item_group: str = "", search_value: str = "") -> Optional[List[Dict]]:
    """
    Get cached items for POS profile
    """
    cache_key = f"pos_items_{pos_profile}_{item_group}_{search_value}"
    return cache.get(cache_key)

def cache_items(pos_profile: str, items: List[Dict], item_group: str = "", search_value: str = "", ttl: int = 300):
    """
    Cache items for POS profile
    """
    cache_key = f"pos_items_{pos_profile}_{item_group}_{search_value}"
    cache.set(cache_key, items, ttl)

def get_cached_customer(customer_id: str) -> Optional[Dict]:
    """
    Get cached customer data
    """
    cache_key = f"pos_customer_{customer_id}"
    return cache.get(cache_key)

def cache_customer(customer_id: str, customer_data: Dict, ttl: int = 600):
    """
    Cache customer data
    """
    cache_key = f"pos_customer_{customer_id}"
    cache.set(cache_key, customer_data, ttl)

def get_cached_offers(pos_profile: str) -> Optional[List[Dict]]:
    """
    Get cached offers for POS profile
    """
    cache_key = f"pos_offers_{pos_profile}"
    return cache.get(cache_key)

def cache_offers(pos_profile: str, offers: List[Dict], ttl: int = 600):
    """
    Cache offers for POS profile
    """
    cache_key = f"pos_offers_{pos_profile}"
    cache.set(cache_key, offers, ttl)

def invalidate_pos_cache(pos_profile: str):
    """
    Invalidate all cache entries for a POS profile
    """
    patterns = [
        f"pos_items_{pos_profile}_*",
        f"pos_offers_{pos_profile}",
        f"pos_coupons_{pos_profile}"
    ]
    
    total_deleted = 0
    for pattern in patterns:
        total_deleted += cache.clear_pattern(pattern)
    
    frappe.logger().info(f"Invalidated {total_deleted} cache entries for POS profile: {pos_profile}")
    return total_deleted

@frappe.whitelist()
def get_cache_stats():
    """
    Get cache statistics
    """
    if not cache.cache_enabled:
        return {
            'enabled': False,
            'message': 'Redis cache is not enabled'
        }
    
    try:
        info = cache.redis_client.info()
        return {
            'enabled': True,
            'connected_clients': info.get('connected_clients', 0),
            'used_memory': info.get('used_memory_human', '0B'),
            'keyspace_hits': info.get('keyspace_hits', 0),
            'keyspace_misses': info.get('keyspace_misses', 0),
            'hit_rate': calculate_hit_rate(info.get('keyspace_hits', 0), info.get('keyspace_misses', 0))
        }
    except Exception as e:
        return {
            'enabled': True,
            'error': str(e)
        }

def calculate_hit_rate(hits: int, misses: int) -> float:
    """
    Calculate cache hit rate percentage
    """
    total = hits + misses
    if total == 0:
        return 0.0
    return round((hits / total) * 100, 2)

@frappe.whitelist()
def clear_all_cache():
    """
    Clear all cache entries
    """
    if not cache.cache_enabled:
        return {
            'success': False,
            'message': 'Redis cache is not enabled'
        }
    
    try:
        cache.redis_client.flushdb()
        return {
            'success': True,
            'message': 'All cache entries cleared successfully'
        }
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }
