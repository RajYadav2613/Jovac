const GROQ_API_KEY = "";
const GROQ_MODEL = "llama-3.3-70b-versatile";

const chatForm = document.getElementById("chatForm");
const chatBox = document.getElementById("chatBox");
const userInput = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
const quickPrompts = document.getElementById("quickPrompts");

const conversation = [];

function nowTime() {
	const d = new Date();
	return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function addMessage(role, text) {
	const item = document.createElement("article");
	item.className = `msg ${role}`;
	item.innerHTML = `
		<div class="bubble"></div>
		<time>${nowTime()}</time>
	`;
	item.querySelector(".bubble").textContent = text;
	chatBox.appendChild(item);
	chatBox.scrollTop = chatBox.scrollHeight;
}

function setTyping(show) {
	const existing = document.getElementById("typing");
	if (show && !existing) {
		const item = document.createElement("article");
		item.className = "msg bot";
		item.id = "typing";
		item.innerHTML = `
			<div class="bubble">Analyzing symptoms...</div>
			<time>${nowTime()}</time>
		`;
		chatBox.appendChild(item);
		chatBox.scrollTop = chatBox.scrollHeight;
	}
	if (!show && existing) {
		existing.remove();
	}
}

function buildMessages(userText) {
	const systemPrompt = [
		"You are a careful health triage assistant.",
		"Analyze symptoms and provide a non-diagnostic first-level assessment.",
		"Reply naturally in a human, calm tone.",
		"Include possible causes, urgency level, what to do now, and warning signs to watch.",
		"Do not claim a confirmed diagnosis.",
	].join("\n");

	const history = conversation.slice(-8).map((msg) => ({
		role: msg.role === "user" ? "user" : "assistant",
		content: msg.text,
	}));

	return [
		{ role: "system", content: systemPrompt },
		...history,
		{ role: "user", content: userText },
	];
}

async function getGroqReply(userText) {
	if (!GROQ_API_KEY) {
		throw new Error("Groq key missing");
	}

	const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${GROQ_API_KEY}`,
		},
		body: JSON.stringify({
			model: GROQ_MODEL,
			messages: buildMessages(userText),
			temperature: 0.35,
			max_tokens: 360,
		}),
	});

	const data = await response.json();
	if (!response.ok) {
		throw new Error(data.error?.message || "Request failed");
	}

	const answer = data.choices?.[0]?.message?.content?.trim();
	if (!answer) {
		throw new Error("Empty model response");
	}
	return answer;
}

async function handleSend() {
	const text = userInput.value.trim();
	if (!text) return;

	addMessage("user", text);
	conversation.push({ role: "user", text });
	userInput.value = "";
	sendBtn.disabled = true;
	setTyping(true);

	try {
		const reply = await getGroqReply(text);
		setTyping(false);
		addMessage("bot", reply);
		conversation.push({ role: "bot", text: reply });
	} catch (error) {
		setTyping(false);
		addMessage("bot", "I could not analyze right now. Please try again in a moment.");
		console.error(error);
	} finally {
		sendBtn.disabled = false;
	}
}

chatForm.addEventListener("submit", async (event) => {
	event.preventDefault();
	await handleSend();
});

userInput.addEventListener("keydown", async (event) => {
	if (event.key === "Enter" && !event.shiftKey) {
		event.preventDefault();
		await handleSend();
	}
});

quickPrompts.addEventListener("click", (event) => {
	const target = event.target;
	if (!(target instanceof HTMLElement)) return;
	if (!target.classList.contains("chip")) return;
	userInput.value = target.textContent || "";
	userInput.focus();
});
