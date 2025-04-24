
document.addEventListener('DOMContentLoaded', () => {
    const editButton = document.getElementById('editButton');
    const planForm = document.getElementById('planForm');
    const inputElements = planForm.querySelectorAll('input, textarea');
    let isEditing = false;

    // Initially disable all input fields
    inputElements.forEach(element => element.disabled = true);

    editButton.addEventListener('click', () => {
        isEditing = !isEditing;
        
        if (isEditing) {
            // Enable editing
            editButton.innerHTML = '💾 Save Plan';
            editButton.classList.remove('bg-sky-600', 'hover:bg-sky-700');
            editButton.classList.add('bg-green-600', 'hover:bg-green-700');
            inputElements.forEach(element => {
                element.disabled = false;
                element.classList.add('border-green-300');
            });
        } else {
            // Save changes
            const planId = document.getElementById('planId').value;
            const formData = {
                short_name: document.getElementById('shortName').value,
                full_name: document.getElementById('fullName').value,
                summary_of_benefits: document.getElementById('benefitsSummary').value,
                summary_of_benefits_url: document.getElementById('benefitsUrl').value,
                compressed_summary: document.getElementById('compressedSummary').value
            };

            // Send update request
            fetch(`/plans/${planId}/update`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                // Disable editing and update UI
                editButton.innerHTML = '✏️ Edit Plan';
                editButton.classList.remove('bg-green-600', 'hover:bg-green-700');
                editButton.classList.add('bg-sky-600', 'hover:bg-sky-700');
                inputElements.forEach(element => {
                    element.disabled = true;
                    element.classList.remove('border-green-300');
                });
                
                // Show success message
                alert('Plan updated successfully!');
            })
            .catch(error => {
                console.error('Error:', error);
                alert('Failed to update plan. Please try again.');
                // Keep editing mode on if save failed
                isEditing = true;
            });
        }
    });
});
