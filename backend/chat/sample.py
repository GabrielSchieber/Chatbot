import asyncio
from typing import AsyncGenerator, Literal, get_args
from threading import Thread

model = None
tokenizer = None
device = "cuda"

Model = Literal["SmolLM2-135M", "SmolLM2-360M", "SmolLM2-1.7B"]
current_model_name = ""

async def sample_model(model_name: Model, messages: list[dict[str, str]], max_tokens: int) -> AsyncGenerator[str]:
    global current_model_name

    if model_name != current_model_name or model is None or tokenizer is None:
        current_model_name = model_name
        await asyncio.get_event_loop().run_in_executor(None, load_model, model_name)

    input_text = tokenizer.apply_chat_template(messages, tokenize = False)
    inputs = tokenizer.encode(input_text, return_tensors = "pt").to(device)

    from transformers import AsyncTextIteratorStreamer

    streamer = AsyncTextIteratorStreamer(tokenizer, skip_special_tokens = True)
    generation_kwargs = dict(inputs = inputs, streamer = streamer, max_new_tokens = max_tokens, temperature = 0.2, top_p = 0.9, do_sample = True)

    sample_thread = Thread(target = model.generate, kwargs = generation_kwargs)
    sample_thread.start()

    i = 0
    async for token in streamer:
        if i < 6 or token == "":
            i += 1
            continue
        yield token

def set_up_torch():
    import torch
    torch.set_default_dtype(torch.bfloat16)
    torch.set_flush_denormal(True)
    torch.set_num_threads(torch.get_num_threads())

def load_model(model_name: Model):
    assert model_name in get_args(Model)
    set_up_torch()
    from transformers import AutoTokenizer, AutoModelForCausalLM
    set_up_torch()
    global model, tokenizer
    checkpoint = f"HuggingFaceTB/{model_name}-Instruct"
    tokenizer = AutoTokenizer.from_pretrained(checkpoint)
    model = AutoModelForCausalLM.from_pretrained(checkpoint).to(device)