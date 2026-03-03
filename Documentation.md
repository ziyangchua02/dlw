# 📘 MasteryFlow (DLW)
## AI-Powered Learning State Modeling & Personalized Mastery Guidance System

---

# 1. Executive Summary

MasteryFlow is an AI-powered learning intelligence system designed to model a student’s evolving knowledge state over time and provide personalized, explainable, and actionable study guidance.

Unlike traditional grade dashboards, MasteryFlow moves beyond static correctness prediction and instead:

- Models **knowledge mastery per concept**
- Detects **learning stagnation, regression, and acceleration**
- Differentiates between **careless mistakes vs conceptual weakness**
- Provides **time-aware, explainable study prioritization**
- Adapts to long inactivity gaps and burst revision cycles
- Ensures responsible AI usage with transparency and student control

The system is designed for long-term usage across weeks, months, or academic semesters.

---

# 2. Problem Framing

Students generate rich interaction data across digital platforms:

- Question attempts  
- Timestamps  
- Scores  
- Topic tags  
- Attempt frequency  
- Session behavior  
- Time-to-answer  

However, students lack insight into:

- True conceptual weaknesses  
- Whether they are improving or regressing  
- Which topics deserve limited study time  
- Patterns of repeated struggle  
- Learning decay after inactivity  

Learning is non-linear and temporal. Therefore, a robust solution must:

1. Track learning state over time  
2. Adapt to behavioral shifts  
3. Provide interpretable recommendations  
4. Preserve trust and agency  

---

# 3. System Overview

## Core Philosophy

> Prioritize Mastery over Grades.

We model learning as a dynamic knowledge state that evolves over time instead of focusing purely on accuracy or GPA.

---

# 4. System Architecture

## 4.1 Frontend (Student Dashboard)

Built with:
- React (SPA architecture)
- Data visualization (radar/spider charts, time-series graphs)
- Supabase integration for real-time learning data

Features:
- Mastery Spider Chart per module
- Trend graphs (Improvement vs Regression)
- Weakness Classification Panel
- Priority Recommendation Panel
- Study Focus Simulation (“If I only have 2 hours…”)

---

## 4.2 Backend

Node.js-based backend service with:

- Learning State Engine
- Temporal Mastery Model
- Decay Engine
- Recommendation Engine
- Explanation Generator

Data stored in:
- Supabase (Postgres)
- Structured student attempt logs

---

## 4.3 Data Model

Each interaction event contains:

| Field | Description |
|-------|------------|
| student_id | Unique student identifier |
| module_code | Subject module |
| topic_tag | Concept tag |
| question_id | Question identifier |
| attempt_number | Attempt index |
| correctness | Boolean |
| timestamp | Event time |
| time_taken | Response duration |
| difficulty | Question difficulty |

---

# 5. Learning State Modeling

## 5.1 Knowledge State Representation

Each student has:

- Mastery Score per Topic ∈ [0,1]  
- Confidence Score  
- Trend Direction  
- Volatility Index  

Mastery is modeled as:
Mastery_t = Weighted moving average of recent attempts
adjusted by difficulty
adjusted by recency

---

## 5.2 Time-Aware Decay Modeling

To account for inactivity:
Adjusted Mastery = Base Mastery × e^(-λ × inactivity_days)


This enables:

- Gradual decay after inactivity  
- Rapid recovery after revision bursts  
- Realistic long-term tracking  

---

## 5.3 Distinguishing Weakness Types

### A. Conceptual Weakness
- Low long-term mastery  
- Consistent incorrect attempts  
- High repeat failure on same tag  

### B. Careless Mistake
- High historical mastery  
- Sudden incorrect spike  
- Short response time  
- Isolated deviation  

### C. Volatility Pattern
- Alternating correct/incorrect  
- Suggests unstable understanding  

This goes beyond simple correctness prediction.

---

# 6. Recommendation Engine

## 6.1 Priority Ranking

Each topic receives a Priority Score:
Priority = (1 - Mastery) × Importance × Recency Weight × Volatility


Example output:

> Focus on Calculus – Integration by Parts.  
> Reason: Low mastery (0.42), declining trend over last 7 days.

---

## 6.2 Limited Time Optimization

When a student selects:

> “I have 2 hours to study.”

The system performs:

- Knapsack-style optimization  
- Maximizes mastery gain per minute  
- Suggests high-impact topics first  

---

## 6.3 Repeated Struggle Detection

Pattern detection identifies:

- Same error type repeatedly  
- Same concept family weakness  
- Struggles after long inactivity  

Example explanation:

> You repeatedly struggle with eigenvalue decomposition after 5+ day gaps. Consider spaced reinforcement.

---

# 7. Explainability Framework

Every recommendation includes:

| Field | Description |
|-------|------------|
| Trigger Reason | Why this was flagged |
| Data Evidence | Historical stats used |
| Confidence | Model certainty |
| Alternative Options | Other focus areas |
| Override Option | Student choice |

Example:

> Recommended because your mastery dropped from 0.71 to 0.53 over 3 sessions. 4 of last 6 attempts incorrect.

No black-box outputs.

---

# 8. Adaptation to Long-Term Behavior

## 8.1 Inactivity Gaps
- Mastery decay applied gradually  
- Re-entry recommendations adjust  

## 8.2 Burst Revision
- Fast recovery scaling  
- Mastery stabilization check  

## 8.3 Accelerated Improvement
- Positive reinforcement  
- Reduce over-revision risk  

---

# 9. Responsible AI in Education

## 9.1 Explainability
- All outputs include justification  
- Students see input features used  

## 9.2 Determinism
- Same data → same output  
- Controlled randomness eliminated  

## 9.3 Bias Mitigation
- No demographic inputs used  
- Only interaction-based signals  

## 9.4 Privacy
- Minimal necessary data stored  
- Student IDs anonymized  
- No external data scraping  

## 9.5 Human Agency
- Students can override recommendations  
- Manual priority adjustment allowed  
- System does not auto-enforce study plans  

---

# 10. Trade-offs & Limitations

| Design Choice | Trade-off |
|--------------|----------|
| Moving average mastery | Simpler than Bayesian Knowledge Tracing |
| Deterministic engine | Less adaptive than deep RL models |
| Topic-level modeling | Does not capture micro-skill granularity |
| Decay constant λ | Requires tuning per subject |

Future improvements:
- Bayesian Knowledge Tracing (BKT)
- Deep Knowledge Tracing (DKT)
- Reinforcement learning-based study planning
- Multi-modal signals (notes, video behavior)

---

# 11. Innovation Beyond Correctness Prediction

✔ Differentiates error types  
✔ Models learning decay  
✔ Time-optimization study planning  
✔ Volatility detection  
✔ Repeated struggle pattern recognition  
✔ Long-term learning trajectory visualization  
✔ Trust-first explainable AI design  

This is not a grade predictor.

It is a cognitive state tracker.

---

# 12. Real-World Applicability

Designed for:

- University LMS integration  
- MOOC platforms  
- Self-learning dashboards  
- Longitudinal academic tracking  

Scales across:

- Weeks  
- Semesters  
- Academic years  

---

# 13. Evaluation Strategy

We evaluate via:

1. Mastery Stability Improvement  
2. Reduced Repeated Struggle Rate  
3. Increased Study Efficiency  
4. Student Trust Feedback  
5. Retention after inactivity gaps  

---

# 14. Future Roadmap

- AI Tutor Agent (Conversational)  
- Multi-Agent Diagnosis & Planner  
- Emotional State Modeling  
- Cross-platform learning aggregation  
- Institutional analytics dashboard  

---

# 15. Conclusion

MasteryFlow provides:

- Actionable personalized guidance  
- Transparent and explainable AI  
- Temporal learning modeling  
- Responsible AI safeguards  
- Realistic long-term usability  

It transforms raw interaction logs into:

> Clear, trustworthy, adaptive mastery intelligence.

