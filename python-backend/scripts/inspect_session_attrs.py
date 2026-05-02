from trulens.core import TruSession

session = TruSession(database_url='sqlite:///.trulens/default.sqlite')
print('TruSession repr:')
print(repr(session))
print('\nATTRS:')
for a in dir(session):
    if not a.startswith('_'):
        print(a)

# Try to access engine or raw connection
print('\nENGINE_ATTRS:')
for name in ('engine','_engine','conn','connection','get_engine'):
    print(name, hasattr(session, name))
