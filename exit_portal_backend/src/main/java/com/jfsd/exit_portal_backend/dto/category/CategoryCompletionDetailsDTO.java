package com.jfsd.exit_portal_backend.dto.category;

import java.util.List;
import java.util.Map;

public class CategoryCompletionDetailsDTO {
    private List<StudentSummaryDTO> completed;
    private List<StudentSummaryDTO> incomplete;
    private Map<String, IncompleteStudentDetailDTO> incompleteDetailsById;
    private Map<String, CompletedStudentDetailDTO> completedDetailsById;
    private Integer categoryMinRequiredCourses;
    private Double categoryMinRequiredCredits;
    // Optional: marks a completed student as projected (true) when they become complete by counting registered courses/credits
    private Map<String, Boolean> projectedById;

    public CategoryCompletionDetailsDTO() {}

    public List<StudentSummaryDTO> getCompleted() { return completed; }
    public void setCompleted(List<StudentSummaryDTO> completed) { this.completed = completed; }

    public List<StudentSummaryDTO> getIncomplete() { return incomplete; }
    public void setIncomplete(List<StudentSummaryDTO> incomplete) { this.incomplete = incomplete; }

    public Map<String, IncompleteStudentDetailDTO> getIncompleteDetailsById() { return incompleteDetailsById; }
    public void setIncompleteDetailsById(Map<String, IncompleteStudentDetailDTO> incompleteDetailsById) { this.incompleteDetailsById = incompleteDetailsById; }

    public Map<String, CompletedStudentDetailDTO> getCompletedDetailsById() { return completedDetailsById; }
    public void setCompletedDetailsById(Map<String, CompletedStudentDetailDTO> completedDetailsById) { this.completedDetailsById = completedDetailsById; }

    public Integer getCategoryMinRequiredCourses() { return categoryMinRequiredCourses; }
    public void setCategoryMinRequiredCourses(Integer categoryMinRequiredCourses) { this.categoryMinRequiredCourses = categoryMinRequiredCourses; }

    public Double getCategoryMinRequiredCredits() { return categoryMinRequiredCredits; }
    public void setCategoryMinRequiredCredits(Double categoryMinRequiredCredits) { this.categoryMinRequiredCredits = categoryMinRequiredCredits; }

    public Map<String, Boolean> getProjectedById() { return projectedById; }
    public void setProjectedById(Map<String, Boolean> projectedById) { this.projectedById = projectedById; }
}
