import asyncio
from typing import AsyncGenerator
from threading import Thread

model = None
tokenizer = None
device = "cuda"

async def sample_model(messages: list[dict[str, str]], max_tokens: int) -> AsyncGenerator[str]:
    if model is None or tokenizer is None:
        await asyncio.get_event_loop().run_in_executor(None, load_model)

    input_text = tokenizer.apply_chat_template(messages, tokenize = False)
    inputs = tokenizer.encode(input_text, return_tensors = "pt").to(device)

    from transformers import AsyncTextIteratorStreamer

    streamer = AsyncTextIteratorStreamer(tokenizer, skip_special_tokens = True)
    generation_kwargs = dict(inputs = inputs, streamer = streamer, max_new_tokens = max_tokens, temperature = 0.2, top_p = 0.9, do_sample = True)

    sample_thread = Thread(target = model.generate, kwargs = generation_kwargs)
    sample_thread.start()

    i = 0
    async for token in streamer:
        if i < 6:
            i += 1
            continue
        yield token

def load_model():
    from transformers import AutoTokenizer, AutoModelForCausalLM
    global model, tokenizer
    checkpoint = "HuggingFaceTB/SmolLM2-135M-Instruct"
    tokenizer = AutoTokenizer.from_pretrained(checkpoint)
    model = AutoModelForCausalLM.from_pretrained(checkpoint).to(device)