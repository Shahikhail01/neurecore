// src/modules/observability/metrics.service.ts
import { Injectable } from '@nestjs/common';

interface Counter {
  inc(labels?: Record<string, string>): void;
}

interface Gauge {
  set(value: number): void;
}

interface Histogram {
  observe(value: number, labels?: Record<string, string>): void;
}

class SimpleCounter implements Counter {
  private value = 0;
  inc() {
    this.value++;
  }
  getValue() {
    return this.value;
  }
}

class SimpleGauge implements Gauge {
  private value = 0;
  set(value: number) {
    this.value = value;
  }
  getValue() {
    return this.value;
  }
}

class SimpleHistogram implements Histogram {
  private values: number[] = [];
  observe(value: number) {
    this.values.push(value);
  }
  getValues() {
    return this.values;
  }
}

export const GOLDEN_PATH_METRICS = {
  initiations_created_total: new SimpleCounter(),
  initiations_approved_total: new SimpleCounter(),
  initiations_failed_total: new SimpleCounter(),

  project_command_success_total: new SimpleCounter(),
  project_command_duplicate_suppressed_total: new SimpleCounter(),

  outbox_event_age_seconds: new SimpleHistogram(),
  outbox_backlog_size: new SimpleGauge(),
  event_processing_latency_seconds: new SimpleHistogram(),
  job_retries_total: new SimpleCounter(),
  job_dead_letters_total: new SimpleCounter(),

  automation_completion_rate: new SimpleGauge(),
  assignment_success_total: new SimpleCounter(),
  assignment_failure_total: new SimpleCounter(),

  execution_queue_time_seconds: new SimpleHistogram(),
  execution_duration_seconds: new SimpleHistogram(),
  attempt_success_total: new SimpleCounter(),
  attempt_retry_total: new SimpleCounter(),
  attempt_failure_total: new SimpleCounter(),
  needs_input_total: new SimpleCounter(),
  needs_review_total: new SimpleCounter(),

  approval_total: new SimpleCounter(),
  revision_requested_total: new SimpleCounter(),

  tool_failure_total: new SimpleCounter(),
  token_usage_total: new SimpleCounter(),
  estimated_cost_total: new SimpleCounter(),

  socket_reconnect_total: new SimpleCounter(),
  socket_error_total: new SimpleCounter(),
  session_refresh_failure_total: new SimpleCounter(),
};

@Injectable()
export class MetricsService {
  getMetrics() {
    const result: Record<string, any> = {};
    for (const [name, metric] of Object.entries(GOLDEN_PATH_METRICS)) {
      if (metric instanceof SimpleCounter) {
        result[name] = { type: 'counter', value: metric.getValue() };
      } else if (metric instanceof SimpleGauge) {
        result[name] = { type: 'gauge', value: metric.getValue() };
      } else if (metric instanceof SimpleHistogram) {
        result[name] = { type: 'histogram', values: metric.getValues() };
      }
    }
    return result;
  }
}
