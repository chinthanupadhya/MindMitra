import re

file_path = "/Users/chinthangupadhya/MindMitra/MindMitra-Frontend/screens/TalkToMitraScreen.tsx"
with open(file_path, "r") as f:
    content = f.read()

# Fix the FormData append for React Native Android
new_content = content.replace(
    "form.append('file', { uri, type: 'audio/m4a', name } as any);",
    "const fileUri = uri.startsWith('file://') ? uri : `file://${uri}`;\n      form.append('file', { uri: fileUri, type: 'audio/m4a', name } as any);"
)

with open(file_path, "w") as f:
    f.write(new_content)
print("Updated TalkToMitraScreen.tsx")
