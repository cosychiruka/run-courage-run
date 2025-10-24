import React, { useState, useCallback } from 'react';
import ErrorBoundary from './ErrorBoundary';

const FeedbackSection = () => {
  const [feedback, setFeedback] = useState("");

  // Memoize the submit handler to prevent unnecessary re-renders
  const handleSubmit = useCallback((e) => {
    e.preventDefault();
    // Handle form submission logic
    alert("Thank you for your feedback!");
    setFeedback("");
  }, [setFeedback]);

  return (
    <ErrorBoundary fallbackText="Feedback form couldn't load. Please refresh the page.">
      <section className="feedback-section">
        <h2>Feedback & Suggestions</h2>
        <form onSubmit={handleSubmit}>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Enter your feedback here..."
            required
          />
          <button type="submit">Submit Feedback</button>
        </form>
      </section>
    </ErrorBoundary>
  );
};

export default FeedbackSection;
