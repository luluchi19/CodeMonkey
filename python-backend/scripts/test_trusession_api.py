from trulens.core import TruSession

session = TruSession(database_url='sqlite:///.trulens/default.sqlite')
print('TruSession methods:')
print([m for m in dir(session) if not m.startswith('_')])
