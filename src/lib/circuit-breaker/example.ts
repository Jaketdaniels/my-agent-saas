/**
 * Example usage of the Circuit Breaker pattern
 */

import { 
  getCircuitBreaker, 
  withCircuitBreaker,
  CircuitState 
} from "./index";

/**
 * Example 1: Protecting an external API call
 */
export async function callExternalAPIWithCircuitBreaker(endpoint: string) {
  const breaker = getCircuitBreaker("external-api", {
    failureThreshold: 3,      // Open after 3 failures
    successThreshold: 2,      // Close after 2 successes in HALF_OPEN
    timeout: 30000,          // Try again after 30 seconds
    volumeThreshold: 5       // Need at least 5 requests to activate
  });

  return breaker.execute(async () => {
    const response = await fetch(endpoint, {
      signal: AbortSignal.timeout(5000) // 5 second timeout
    });
    
    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }
    
    return response.json();
  });
}

/**
 * Example 2: Protecting database operations
 */
export async function queryDatabaseWithCircuitBreaker(query: string) {
  const breaker = getCircuitBreaker("database", {
    failureThreshold: 5,
    successThreshold: 3,
    timeout: 60000,
    volumeThreshold: 10
  });

  try {
    return await breaker.execute(async () => {
      // Your database query here
      // This would be replaced with actual DB call
      const result = await simulateDatabaseQuery(query);
      return result;
    });
  } catch (error) {
    // Check if circuit is open to provide better error message
    const status = await breaker.getStatus();
    if (status.state === CircuitState.OPEN) {
      console.error("Database is currently unavailable. Circuit breaker is open.");
      // Could return cached data or default response here
      return null;
    }
    throw error;
  }
}

/**
 * Example 3: Using the decorator pattern
 */
// Example usage: const service = new PaymentService();
// eslint-disable-next-line @typescript-eslint/no-unused-vars
class PaymentService {
  @withCircuitBreaker("payment-gateway", {
    failureThreshold: 2,  // Payment services need high reliability
    successThreshold: 5,  // Require more successes to restore trust
    timeout: 120000       // 2 minutes before retry
  })
  async processPayment(amount: number, token: string): Promise<boolean> {
    // Simulate payment processing
    const response = await fetch("/api/payments/process", {
      method: "POST",
      body: JSON.stringify({ amount, token }),
      headers: { "Content-Type": "application/json" }
    });
    
    if (!response.ok) {
      throw new Error("Payment processing failed");
    }
    
    return true;
  }
}

/**
 * Example 4: Protecting AI/LLM API calls
 */
export async function callAIServiceWithCircuitBreaker(
  prompt: string,
  model: string = "gpt-4"
) {
  const breaker = getCircuitBreaker(`ai-service-${model}`, {
    failureThreshold: 3,
    successThreshold: 2,
    timeout: 45000,        // 45 seconds
    volumeThreshold: 1     // Activate immediately (AI calls are expensive)
  });

  return breaker.execute(async () => {
    // Simulate AI API call
    const response = await fetch("/api/ai/complete", {
      method: "POST",
      body: JSON.stringify({ prompt, model }),
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(30000) // 30 second timeout
    });
    
    if (!response.ok) {
      throw new Error(`AI service returned ${response.status}`);
    }
    
    return response.json();
  });
}

/**
 * Example 5: Manual circuit control for maintenance
 */
export async function performMaintenanceMode() {
  const apiBreaker = getCircuitBreaker("external-api");
  const dbBreaker = getCircuitBreaker("database");
  
  // Manually open circuits during maintenance
  await apiBreaker.trip();
  await dbBreaker.trip();
  
  console.log("Maintenance mode activated - circuits opened");
  
  // After maintenance
  setTimeout(async () => {
    await apiBreaker.reset();
    await dbBreaker.reset();
    console.log("Maintenance completed - circuits reset");
  }, 300000); // 5 minutes
}

/**
 * Example 6: Monitoring circuit breaker status
 */
export async function monitorCircuitBreakers() {
  const circuitNames = ["external-api", "database", "payment-gateway", "ai-service-gpt-4"];
  
  const statuses = await Promise.all(
    circuitNames.map(async (name) => {
      const breaker = getCircuitBreaker(name);
      return breaker.getStatus();
    })
  );
  
  // Log or send to monitoring service
  statuses.forEach(status => {
    console.log(`Circuit: ${status.name}`);
    console.log(`  State: ${status.state}`);
    console.log(`  Failure Rate: ${status.metrics.failureRate * 100}%`);
    console.log(`  Total Requests: ${status.metrics.totalRequests}`);
    
    if (status.state === CircuitState.OPEN) {
      console.log(`  Will retry at: ${status.metrics.nextRetryTime}`);
    }
  });
  
  return statuses;
}

/**
 * Example 7: Fallback pattern with circuit breaker
 */
export async function getDataWithFallback(id: string) {
  const primaryBreaker = getCircuitBreaker("primary-service");
  const secondaryBreaker = getCircuitBreaker("secondary-service");
  
  try {
    // Try primary service first
    return await primaryBreaker.execute(async () => {
      const response = await fetch(`/api/primary/data/${id}`);
      if (!response.ok) throw new Error("Primary service failed");
      return response.json();
    });
  } catch {
    console.log("Primary service failed, trying secondary...");
    
    try {
      // Fallback to secondary service
      return await secondaryBreaker.execute(async () => {
        const response = await fetch(`/api/secondary/data/${id}`);
        if (!response.ok) throw new Error("Secondary service failed");
        return response.json();
      });
    } catch {
      console.log("Both services failed, returning cached data");
      
      // Both failed, return cached or default data
      return getCachedData(id) || getDefaultData();
    }
  }
}

// Helper functions for examples
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function simulateDatabaseQuery(_query: string) {
  // Simulate database query
  return new Promise((resolve) => {
    setTimeout(() => resolve({ data: "result" }), 100);
  });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function getCachedData(_id: string) {
  // Return cached data if available
  return null;
}

function getDefaultData() {
  return { data: "default", cached: true };
}