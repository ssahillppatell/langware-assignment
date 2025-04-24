document.addEventListener("DOMContentLoaded", () => {
	const form = document.getElementById("booking-form");
	const resultDiv = document.getElementById("result");
	const submitButton = document.getElementById("submit-btn");

	// Set default date to today
	const today = new Date().toISOString().split("T")[0];
	document.getElementById("date").value = today;

	form.addEventListener("submit", async (event) => {
		event.preventDefault(); // Prevent default form submission
		resultDiv.textContent = "Checking availability...";
		resultDiv.className = "result-message"; // Reset class
		submitButton.disabled = true;

		const formData = new FormData(form);
		const data = {
			url: formData.get("url"),
			name: formData.get("name"),
			date: formData.get("date"),
			time: formData.get("time"),
			guests: formData.get("guests"),
		};

		try {
			const response = await fetch("/run-bot", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(data),
			});

			const result = await response.json();

			if (response.ok && result.success) {
				resultDiv.textContent = `Success: ${result.message || "Table found!"}`;
				resultDiv.classList.add("success");
			} else {
				resultDiv.textContent = `Error: ${result.message || "Failed to find table or internal error."}`;
				resultDiv.classList.add("error");
			}
		} catch (error) {
			console.error("Error submitting form:", error);
			resultDiv.textContent =
				"Error: Could not connect to the server or an unexpected error occurred.";
			resultDiv.classList.add("error");
		} finally {
			submitButton.disabled = false;
		}
	});
});
