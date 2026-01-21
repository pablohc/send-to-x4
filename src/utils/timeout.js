/**
 * Timeout utility for async operations
 */
function withTimeout(promise, ms, errorMessage = 'Operation timed out') {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error(errorMessage));
        }, ms);

        promise
            .then(result => {
                clearTimeout(timer);
                resolve(result);
            })
            .catch(err => {
                clearTimeout(timer);
                reject(err);
            });
    });
}

/**
 * Delay helper
 */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
