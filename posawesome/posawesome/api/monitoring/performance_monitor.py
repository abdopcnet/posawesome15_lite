# -*- coding: utf-8 -*-
"""
Performance Monitoring System for POS Awesome Lite
Tracks and monitors application performance metrics
"""

import time
import frappe
from frappe import _
from typing import Dict, List, Any
import json
from datetime import datetime, timedelta

class PerformanceMonitor:
    """
    Performance monitoring system for POS Awesome Lite
    """
    
    def __init__(self):
        self.metrics = {}
        self.api_calls = []
        self.component_renders = []
        self.database_queries = []
        self.max_records = 1000  # Maximum records to keep in memory
    
    def start_timer(self, operation_id: str) -> str:
        """
        Start timing an operation
        """
        timer_id = f"{operation_id}_{int(time.time() * 1000)}"
        self.metrics[timer_id] = {
            'operation': operation_id,
            'start_time': time.time(),
            'end_time': None,
            'duration': None
        }
        return timer_id
    
    def end_timer(self, timer_id: str) -> float:
        """
        End timing an operation and return duration
        """
        if timer_id in self.metrics:
            end_time = time.time()
            self.metrics[timer_id]['end_time'] = end_time
            duration = end_time - self.metrics[timer_id]['start_time']
            self.metrics[timer_id]['duration'] = duration
            
            # Log performance metric
            self._log_performance_metric(timer_id, duration)
            
            return duration
        return 0.0
    
    def track_api_call(self, endpoint: str, method: str, duration: float, status_code: int = 200):
        """
        Track API call performance
        """
        api_record = {
            'timestamp': datetime.now(),
            'endpoint': endpoint,
            'method': method,
            'duration': duration,
            'status_code': status_code
        }
        
        self.api_calls.append(api_record)
        
        # Keep only recent records
        if len(self.api_calls) > self.max_records:
            self.api_calls = self.api_calls[-self.max_records:]
        
        # Log slow API calls
        if duration > 1.0:  # More than 1 second
            frappe.logger().warning(f"Slow API call: {endpoint} took {duration:.2f}s")
    
    def track_component_render(self, component_name: str, duration: float):
        """
        Track component render performance
        """
        render_record = {
            'timestamp': datetime.now(),
            'component': component_name,
            'duration': duration
        }
        
        self.component_renders.append(render_record)
        
        # Keep only recent records
        if len(self.component_renders) > self.max_records:
            self.component_renders = self.component_renders[-self.max_records:]
        
        # Log slow component renders
        if duration > 0.1:  # More than 100ms
            frappe.logger().warning(f"Slow component render: {component_name} took {duration:.2f}s")
    
    def track_database_query(self, query: str, duration: float, rows_affected: int = 0):
        """
        Track database query performance
        """
        query_record = {
            'timestamp': datetime.now(),
            'query': query[:100] + '...' if len(query) > 100 else query,
            'duration': duration,
            'rows_affected': rows_affected
        }
        
        self.database_queries.append(query_record)
        
        # Keep only recent records
        if len(self.database_queries) > self.max_records:
            self.database_queries = self.database_queries[-self.max_records:]
        
        # Log slow database queries
        if duration > 0.5:  # More than 500ms
            frappe.logger().warning(f"Slow database query took {duration:.2f}s: {query[:50]}...")
    
    def _log_performance_metric(self, timer_id: str, duration: float):
        """
        Log performance metric to Frappe logger
        """
        operation = self.metrics[timer_id]['operation']
        frappe.logger().info(f"[Performance] {operation}: {duration:.2f}ms")
    
    def get_performance_summary(self, hours: int = 1) -> Dict[str, Any]:
        """
        Get performance summary for the last N hours
        """
        cutoff_time = datetime.now() - timedelta(hours=hours)
        
        # Filter recent records
        recent_api_calls = [call for call in self.api_calls if call['timestamp'] > cutoff_time]
        recent_renders = [render for render in self.component_renders if render['timestamp'] > cutoff_time]
        recent_queries = [query for query in self.database_queries if query['timestamp'] > cutoff_time]
        
        # Calculate statistics
        api_stats = self._calculate_api_stats(recent_api_calls)
        render_stats = self._calculate_render_stats(recent_renders)
        query_stats = self._calculate_query_stats(recent_queries)
        
        return {
            'period_hours': hours,
            'api_calls': api_stats,
            'component_renders': render_stats,
            'database_queries': query_stats,
            'summary': {
                'total_api_calls': len(recent_api_calls),
                'total_renders': len(recent_renders),
                'total_queries': len(recent_queries),
                'avg_api_response_time': api_stats.get('average_duration', 0),
                'avg_render_time': render_stats.get('average_duration', 0),
                'avg_query_time': query_stats.get('average_duration', 0)
            }
        }
    
    def _calculate_api_stats(self, api_calls: List[Dict]) -> Dict[str, Any]:
        """
        Calculate API call statistics
        """
        if not api_calls:
            return {'average_duration': 0, 'max_duration': 0, 'min_duration': 0}
        
        durations = [call['duration'] for call in api_calls]
        return {
            'average_duration': sum(durations) / len(durations),
            'max_duration': max(durations),
            'min_duration': min(durations),
            'total_calls': len(api_calls),
            'slow_calls': len([d for d in durations if d > 1.0])
        }
    
    def _calculate_render_stats(self, renders: List[Dict]) -> Dict[str, Any]:
        """
        Calculate component render statistics
        """
        if not renders:
            return {'average_duration': 0, 'max_duration': 0, 'min_duration': 0}
        
        durations = [render['duration'] for render in renders]
        return {
            'average_duration': sum(durations) / len(durations),
            'max_duration': max(durations),
            'min_duration': min(durations),
            'total_renders': len(renders),
            'slow_renders': len([d for d in durations if d > 0.1])
        }
    
    def _calculate_query_stats(self, queries: List[Dict]) -> Dict[str, Any]:
        """
        Calculate database query statistics
        """
        if not queries:
            return {'average_duration': 0, 'max_duration': 0, 'min_duration': 0}
        
        durations = [query['duration'] for query in queries]
        return {
            'average_duration': sum(durations) / len(durations),
            'max_duration': max(durations),
            'min_duration': min(durations),
            'total_queries': len(queries),
            'slow_queries': len([d for d in durations if d > 0.5])
        }

# Global performance monitor instance
performance_monitor = PerformanceMonitor()

@frappe.whitelist()
def get_performance_metrics(hours: int = 1):
    """
    Get performance metrics for the specified time period
    """
    try:
        summary = performance_monitor.get_performance_summary(hours)
        return {
            'success': True,
            'data': summary
        }
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }

@frappe.whitelist()
def clear_performance_metrics():
    """
    Clear all performance metrics
    """
    try:
        performance_monitor.api_calls.clear()
        performance_monitor.component_renders.clear()
        performance_monitor.database_queries.clear()
        performance_monitor.metrics.clear()
        
        return {
            'success': True,
            'message': 'Performance metrics cleared successfully'
        }
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }

# Decorator for monitoring API performance
def monitor_api_performance(endpoint_name: str):
    """
    Decorator to monitor API performance
    """
    def decorator(func):
        def wrapper(*args, **kwargs):
            timer_id = performance_monitor.start_timer(f"api_{endpoint_name}")
            start_time = time.time()
            
            try:
                result = func(*args, **kwargs)
                duration = time.time() - start_time
                performance_monitor.track_api_call(endpoint_name, 'POST', duration, 200)
                return result
            except Exception as e:
                duration = time.time() - start_time
                performance_monitor.track_api_call(endpoint_name, 'POST', duration, 500)
                raise e
            finally:
                performance_monitor.end_timer(timer_id)
        
        return wrapper
    return decorator
