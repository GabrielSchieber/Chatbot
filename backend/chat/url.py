from django.shortcuts import render
from django.urls import re_path

def index(request):
    return render(request, "index.html")

urlpatterns = [re_path(".*", index)]