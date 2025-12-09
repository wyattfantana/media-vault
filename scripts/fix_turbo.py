import json
data = {
    '\': 'https://turbo.build/schema.json',
    'globalDependencies': ['**/.env.*local'],
    'tasks': {
        'build': {
            'dependsOn': ['^build'],
            'outputs': ['dist/**', 'src-tauri/target/**']
        },
        'dev': {
            'cache': False,
            'persistent': True
        },
        'lint': {
            'dependsOn': ['^lint']
        },
        'clean': {
            'cache': False
        }
    }
}
with open('turbo.json', 'w') as f:
    json.dump(data, f, indent=2)
